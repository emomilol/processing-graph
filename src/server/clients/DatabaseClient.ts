import GraphServerClient from '../../interfaces/GraphServerClient';
import { Pool, PoolClient } from 'pg';
import { AnyObject } from '../../types/global';
import GraphRegistry, { DeputyDescriptor } from '../GraphRegistry';
import Task, { ProcessingTask } from '../../graph/Task';
import GraphRoutine from '../../graph/GraphRoutine';
import DatabaseClientQueue from './DatabaseClientQueue';
import { sleep } from '../../utils/promise';
import { schema } from '../db/schema';


export default class DatabaseClient extends GraphServerClient {
  private static instance_: DatabaseClient;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new DatabaseClient();
    }

    return this.instance_;
  }

  private pool;
  private queue: DatabaseClientQueue;
  private readOnly: boolean = false;

  constructor() {
    super();
    this.pool = new Pool( {
      host: process.env.PG_GRAPH_DB_URL ?? 'localhost',
      user: process.env.PG_GRAPH_DB_USER ?? 'postgres',
      database: process.env.PG_GRAPH_DB_NAME ?? 'processing_graph_test',
      password: process.env.PG_GRAPH_DB_PASSWORD ?? 'password',
      max: 5,
    } );
    this.pool.on( 'error', ( err, _ ) => {
      console.error( 'Unexpected error on idle client', err );
      process.exit( -1 );
    } );

    this.queue = new DatabaseClientQueue();
  }

  setReadOnly( value: boolean ) {
    this.readOnly = value;
  }

  private async query( query:string, params?: any[] ) {
    const transaction = ( client: PoolClient, data: AnyObject ) => client.query( query, data.params );
    return await this.waitForDatabase( transaction, this.pool, { params } );
  }

  private async makeTransaction( data: AnyObject, transaction: ( client: PoolClient, context: AnyObject ) => Promise<AnyObject> ): Promise<AnyObject> {
    const client = await this.getClient();
    let context;
    try {
      await client.query( 'BEGIN' );

      context = await this.waitForDatabase( transaction, client, data );

      await client.query('COMMIT');
    } catch ( e ) {
      await client.query('ROLLBACK');
      throw e
    } finally {
      client.release();
    }

    return context ?? data;
  }

  async waitForDatabase(transaction: ( client: any, context: AnyObject ) => Promise<AnyObject>, client: any, context: AnyObject ) {
    for (let i = 0; i < 10; i++) {
      try {
        return await transaction( client, context );
      } catch (err: unknown) {
        if ( err && (err as Error ).message.includes('does not exist') ) {
          console.log(`Waiting for database to be ready...`);
          await new Promise((res) => setTimeout(res, 1000));
        } else {
          console.error('Database query errored: ', err, context);
          return { rows: [] };
        }
      }
    }
    throw new Error(`Timeout waiting for database to be ready`);
  }

  dispatch( data: AnyObject, action: string ) {
    this.queue.add( ( this as any )[ action ].bind( this ), data, data.__graphId ?? 'default' );
  }

  private async getClient(): Promise<PoolClient> {
    const client = await this.pool.connect() as unknown as any;
    const query = client.query;
    const release = client.release;
    // set a timeout of 5 seconds, after which we will log this client's last query
    const timeout = setTimeout( () => {
      console.error( 'A client has been checked out for more than 5 seconds!' );
      console.error( `The last executed query on this client was: ${ client.lastQuery }` );
    }, 5000 );
    // monkey patch the query method to keep track of the last query executed
    client.query = ( ...args: any[] ) => {
      client.lastQuery = args;
      return query.apply( client, args );
    };
    client.release = () => {
      // clear our timeout
      clearTimeout( timeout );
      // set the methods back to their old un-monkey-patched version
      client.query = query;
      client.release = release;
      return release.apply( client );
    };
    return client
  }

  async addAgent( data: AnyObject ) {
    const userAgent = await this.query(
      `WITH input_rows(name, description) AS (VALUES ($1, $2)), 
     ins AS (INSERT INTO agent (name, description) SELECT * FROM input_rows ON CONFLICT ON CONSTRAINT unique_agent DO NOTHING RETURNING uuid) 
        SELECT 'i' as source, uuid FROM ins
        UNION ALL
        SELECT 's' AS source, a.uuid FROM input_rows
        JOIN agent a USING (name, description);`,
      [ data.__name, data.__description ],
    );

    data.__agentId = userAgent.rows[ 0 ]?.[ 'uuid' ];

    this.forwardToServer( 'Added agent', data );
  }

  async addContract( data: AnyObject ) {
    const updatedData = await this.makeTransaction( data, async ( client: PoolClient, _data: AnyObject  ) => {
      await client.query(
        `INSERT INTO context as c (uuid, context) VALUES ($1, $2) ON CONFLICT ON CONSTRAINT context_pkey DO NOTHING;`,
        [ _data.__contextId, _data.__context ],
      );

      await client.query(
        `INSERT INTO contract as c (uuid, agent_id, context, product, issued_at, created) VALUES ($1, $2, $3, $4, $5, $6);`,
        [ _data.__contractId, _data.__agentId, _data.__contextId, _data.__name, this.formatTimestamp( _data.__contractIssueTime ), this.formatTimestamp( _data.__contractIssueTime ) ],
      );

      return _data;
    } );

    this.forwardToServer( 'Contract added to database', updatedData );
  }

  async fulfillContract( data: AnyObject ) {
    const updatedData = await this.makeTransaction( data, async ( client: PoolClient, _data: AnyObject  ) => {
      await client.query(
        `INSERT INTO context as c (uuid, context) VALUES ($1, $2) ON CONFLICT ON CONSTRAINT context_pkey DO NOTHING;`,
        [ _data.__contextId, _data.__context ],
      );

      await client.query(
        `UPDATE contract AS c SET fulfilled = TRUE, fulfilled_at = $1, result_context = $2 WHERE uuid = $3;`,
        [ this.formatTimestamp( _data.__contractFulfilledTime ), _data.__contextId, _data.__contractId ],
      );

      return _data;
    } );

    this.forwardToServer( 'Contract fulfilled status updated on database', updatedData );
  }

  async getServers( data: AnyObject ) {
    await this.query( schema ); // Set up database

    const servers = await this.query(
      `SELECT uuid, address, port, processing_graph, process_pid, is_active FROM server WHERE is_primary = TRUE;`,
    );

    data.__servers = data.__servers ?? [];

    for ( const server of servers.rows ) {
      if ( !data.__servers.find( ( s: { __id: string } ) => s.__id === server[ 'uuid' ] ) ) {
        data.__servers.push( {
          __address: server.address,
          __port: server.port,
          __pid: server.process_pid,
          __id: server[ 'uuid' ],
          __pgId: server.processing_graph,
          __isDeputy: false,
          __isActive: server.is_active,
        } );
      }
    }

    this.forwardToServer( 'Got all servers', data );
  }

  async getSelf() {
    const self = GraphRegistry.instance.getSelfStatus();
    if ( self !== undefined ) {
      const serverId = self.__serverId;
      const serverData = await this.query(
        `SELECT uuid, is_active, is_non_responsive, is_blocked, process_pid
       FROM server
       WHERE uuid = $1;`,
        [ serverId ],
      );

      if ( serverData.rows.length === 1 ) {
        const server = {
          __serverId: serverData.rows[ 0 ]["uuid"],
          __isActive: serverData.rows[ 0 ].is_active,
          __isNonResponsive: serverData.rows[ 0 ].is_non_responsive,
          __isBlocked: serverData.rows[ 0 ].is_blocked,
          __pid: serverData.rows[ 0 ].process_pid
        }
        this.forwardToServer( 'Got self', server );
      }
    }
  }

  async activateSelf( data: AnyObject ) {
    if ( data.__isActive === false ) {
      await this.activateServer( data );
      this.forwardToServer( 'Activated self', data );
    }
  }

  async activateServer( data: AnyObject ) {
    if ( data.__isActive === false ) {
      const result = await this.query(
        `UPDATE server AS s SET is_non_responsive = FALSE, is_active = TRUE, modified = DEFAULT WHERE s.uuid = $1 RETURNING uuid, is_active, is_non_responsive;`,
        [ data.__serverId ],
      );

      this.forwardToServer( 'Activated server', result.rows[0] );
    }
  }

  async addServer( data: AnyObject ) {
    if ( this.readOnly ) {
      return;
    }

    const updatedData = await this.makeTransaction( data, async ( client: PoolClient, _data: AnyObject ) => {
      const res = await client.query(
        `INSERT INTO processing_graph as p (name, description, created) VALUES ($1, $2, $3)
                                                ON CONFLICT ON CONSTRAINT processing_graph_pkey DO UPDATE SET description = $2, modified = DEFAULT
                                                WHERE p.name = $1
                                                RETURNING p.name;`,
        [ _data.__name, _data.__description, this.formatTimestamp( Date.now() ) ],
      );

      const pgId = res.rows[ 0 ].name;

      const server = await client.query(
        `INSERT INTO server as s (processing_graph, address, port, process_pid, is_primary, created) VALUES ($1, $2, $3, $4, $5, $6) 
                                                    ON CONFLICT ON CONSTRAINT unique_server_constraint 
                                                        DO UPDATE SET processing_graph = $1, modified = DEFAULT
                                                    WHERE s.address = $2 AND s.port = $3
                                                    RETURNING s.uuid;`,
        [ pgId, _data.__address, _data.__port, _data.__pid, _data.__isPrimary, this.formatTimestamp( Date.now() ) ],
      );

      _data.__serverId = server.rows[ 0 ][ 'uuid' ];
      _data.__pgId = pgId;

      GraphRegistry.instance.updateSelf( {
        __serverId: _data.__serverId,
        __address: _data.__address,
        __port: _data.__port,
        __pgId: pgId,
        __pid: _data.__pid
      } );

      return _data;

    } );

    this.forwardToServer( 'Added server to database', updatedData );
  }

  async getDeputyServers( data: AnyObject ) {
    const updatedData = await this.makeTransaction( data, async ( client: PoolClient, _data: AnyObject ) => {
      GraphRegistry.instance.forEachDeputy( async ( deputy: DeputyDescriptor ) => {
        const processingGraph = await deputy.task.getProcessingGraph();

        if ( !processingGraph ) {
          _data.__warnings = _data.__warnings ?? [];
          _data.__warnings.push( `No remote routine with name: ${ deputy.name }` );
          console.warn( `No remote routine with name: ${ deputy.name }` );
          return _data;
        }

        const servers = await client.query(
          `SELECT uuid, address, port, process_pid, is_active FROM server s WHERE s.processing_graph = $1;`,
          [ processingGraph ],
        );

        if ( servers.rows.length === 0 ) {
          _data.__warnings = _data.__warnings ?? [];
          _data.__warnings.push( `No servers with processing graph: ${ processingGraph }` );
          console.warn( 'No servers with processing graph', processingGraph );
          return _data;
        }

        _data.__servers = _data.__servers ?? [];

        for ( const server of servers.rows ) {
          if ( !_data.__servers.find( ( s: { __id: string } ) => s.__id === server[ 'uuid' ] ) ) {
            _data.__servers.push( {
              __address: server.address,
              __port: server.port,
              __pid: server.process_pid,
              __id: server[ 'uuid' ],
              __pgId: processingGraph,
              __isDeputy: true,
              __isActive: server.is_active,
            } );
          }
        }

        // TODO Deputy task map
        // const tasks = await client.query(
        //   `SELECT uuid FROM task t WHERE t.name = $1 AND t.processing_graph = $2;`,
        //   [ deputy.name, deputy.processingGraph ],
        // );
        //
        // if ( tasks.rows.length ) {
        //   await client.query(
        //     `UPDATE task AS t SET deputy_task_id = $1;`,
        //     [ tasks.rows[ tasks.rows.length - 1 ][ 'uuid' ] ],
        //   );
        // }
      } );

      return _data;
    } );

    this.forwardToServer( 'Got deputy servers', updatedData );
  }

  async registerServerConnection( data: AnyObject ) {
    if ( this.readOnly ) {
      return;
    }

    if ( !data.__isDeputy || data.__isActive === false ) {
      return;
    }

    const self = GraphRegistry.instance.getSelfStatus();
    if ( self !== undefined ) {
      await this.query(
        `INSERT INTO server_to_server_communication_map(server_id, server_client_id)
                        VALUES ($1, $2) ON CONFLICT ON CONSTRAINT server_to_server_communication_map_pkey DO NOTHING;`,
        [ data.__id, self.__serverId ],
      );

      this.forwardToServer( 'Registered server connection', data );
    }
  }

  async serverNotResponding( data: AnyObject ) {
    await this.query(
      `UPDATE server AS s SET is_non_responsive = TRUE, is_active = FALSE, modified = DEFAULT WHERE s.uuid = $1;`,
      [ data.__serverId ],
    );

    this.forwardToServer( 'Updated server active state on database', data );
  }

  async addTasks( data: AnyObject ) {
    if ( this.readOnly ) {
      return;
    }

    const updatedData = await this.makeTransaction( data, async ( client: PoolClient, _data: AnyObject ) => {
      GraphRegistry.instance.forEachTask( async ( task: Task ) => {

        const taskDescriptor = task.export();

        const taskRegistry = await client.query(
          `INSERT INTO task AS t (
          name,
          description,
          processing_graph,
          concurrency,
          is_unique,
          layer_index,
          function_string,
          created
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
          ON CONFLICT ON CONSTRAINT unique_task_constraint
              DO UPDATE SET ( description, concurrency, is_unique, layer_index ) = ( $2, $4, $5, $6 )
          WHERE t.name = $1 AND t.processing_graph = $3 AND t.function_string = $7
          RETURNING t.uuid;`,
          [
            taskDescriptor.__name,
            taskDescriptor.__description,
            _data.__pgId,
            taskDescriptor.__concurrency,
            taskDescriptor.__isUnique,
            taskDescriptor.__layerIndex,
            taskDescriptor.__functionString,
            this.formatTimestamp( Date.now() ),
          ],
        );

        task.setGlobalId( taskRegistry.rows[ 0 ][ 'uuid' ] );
      } );

      return _data;

    } );

    this.forwardToServer( 'Added tasks to database', updatedData );
  }

  async addTaskConnectionMaps( data: AnyObject ) {
    if ( this.readOnly ) {
      return;
    }

    const updatedData = await this.makeTransaction( data, async ( client: PoolClient, _data: AnyObject ) => {
      GraphRegistry.instance.forEachTask( async ( task: Task ) => {
        const taskDescriptor = task.export();
        for ( const predecessorId of taskDescriptor.__previousTasks ) {
          await client.query(
            `INSERT INTO directional_task_graph_map(task_id, predecessor_task_id, created) 
            VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;`,
            [
              taskDescriptor.__id,
              predecessorId,
              this.formatTimestamp( Date.now() ),
            ],
          );
        }
      } );

      return _data;
    } );

    this.forwardToServer( 'Added task connection maps to data base', updatedData );
  }

  // async getTasks( data: AnyObject ) {
  //   // TODO
  // }

  async addRoutines( data: AnyObject ) {
    if ( this.readOnly ) {
      return;
    }

    const updatedData = await this.makeTransaction( data, async ( client: PoolClient, _data: AnyObject ) => {
      GraphRegistry.instance.forEachRoutine( async ( routine: GraphRoutine ) => {
        const routineRegistry = await client.query(
          `INSERT INTO routine AS r (name, description, processing_graph, created)
           VALUES ($1, $2, $3, $4) 
           ON CONFLICT ON CONSTRAINT unique_routine_constraint DO UPDATE SET description = $2
           WHERE r.name = $1 AND r.processing_graph = $3
           RETURNING r.uuid;`,
          [routine.name, routine.description, _data.__pgId, this.formatTimestamp( Date.now() )],
        );

        const routineId = routineRegistry.rows[ 0 ][ 'uuid' ];
        routine.setGlobalId( routineId );

        routine.forEachTask( async ( task: ProcessingTask ) => {
          const iterator = ( task as Task ).getIterator();
          while ( iterator.hasNext() ) {
            const nextTask = iterator.next();
            if ( nextTask ) {
              await client.query(
                `INSERT INTO task_to_routine_map(task_id, routine_id, created) VALUES ($1, $2, $3) ON CONFLICT 
                    ON CONSTRAINT task_to_routine_map_pkey DO NOTHING;`,
                [ nextTask.id, routineId, this.formatTimestamp( Date.now() ) ],
              );
            }
          }
        } );
      } );

      return _data;
    } );

    this.forwardToServer( 'Added routines to database', updatedData );
  }

  async getRoutines( data: AnyObject ) {
    const routines = await this.query( `SELECT name, processing_graph FROM routine WHERE deleted = FALSE;` );

    for ( const routine of routines.rows ) {
      GraphRegistry.instance.registerGlobalRoutine( { name: routine.name, processingGraph: routine.processing_graph } );
    }

    this.forwardToServer( 'Got all routines', data );
  }

  async addRoutineExecution( data: AnyObject ) {
    if ( this.readOnly ) {
      return;
    }

    const self = GraphRegistry.instance.getSelfStatus();
    if ( self !== undefined ) {
      if ( data.__previousRoutineExecution !== null ) {
        const prevRoutineExecution = await this.query(
          `SELECT uuid FROM routine_execution WHERE uuid = $1;`,
          [ data.__previousRoutineExecution ],
        );

        if ( !prevRoutineExecution.rows.length ) { // This is needed because the previous routine execution might not yet have been registered
          await sleep( 100 );
          console.log( 'Trying to save routine execution...', data.__previousRoutineExecution );
          await this.addRoutineExecution( data );
          return;
        }
      }

      const updatedData = await this.makeTransaction( data, async ( client: PoolClient, _data: AnyObject ) => {
        await client.query(
          `INSERT INTO context (uuid, context) VALUES ($1, $2) ON CONFLICT ON CONSTRAINT context_pkey DO NOTHING;`,
          [
            _data.__context.__id,
            _data.__context.__context
          ],
        );

        await client.query(
          `INSERT INTO routine_execution(
            uuid, server_id, routine_id, description, previous_routine_execution, contract_id, created, context_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT ON CONSTRAINT routine_execution_pkey DO NOTHING;`,
          [
            _data.__graphId,
            self.__serverId,
            _data.__routineId,
            _data.__routineName,
            _data.__previousRoutineExecution,
            _data.__contractId,
            this.formatTimestamp( _data.__scheduled ),
            _data.__context.__id,
          ],
        );

        return _data;
      } );

      this.forwardToServer( 'Added routine execution to database', updatedData );
    }
  }

  async graphProgressUpdate( data: AnyObject ) {
    if ( this.readOnly ) {
      return;
    }

    // TODO
    this.forwardToServer( 'Updated graph progress on database', data );
  }

  async runningGraph( data: AnyObject ) {
    if ( this.readOnly ) {
      return;
    }

    await this.query(
      `UPDATE routine_execution AS re SET is_running = TRUE WHERE re.uuid = $1;`,
      [ data.__graphId ],
    );

    this.forwardToServer( 'Updated graph running status on database', data );
  }

  async graphErrored( data: AnyObject ) {
    if ( this.readOnly ) {
      return;
    }

    const updatedData = await this.makeTransaction( data, async ( client: PoolClient, _data: AnyObject ) => {
      await client.query(
        `INSERT INTO context (uuid, context) VALUES ($1, $2) ON CONFLICT ON CONSTRAINT context_pkey DO NOTHING;`,
        [
          _data.__context.__id,
          _data.__context.__context
        ],
      );

      await client.query(
        `UPDATE routine_execution AS re SET errored = $1, failed = $2, result_context_id = $3 WHERE re.uuid = $4;`,
        [ !!_data.__errored, !!_data.__failed, _data.__context.__id, _data.__graphId ],
      );

      return _data;
    } );

    this.forwardToServer( 'Updated graph errored status on database', updatedData );
  }

  async graphComplete( data: AnyObject ) {
    if ( this.readOnly ) {
      return;
    }

    const updatedData = await this.makeTransaction( data, async ( client: PoolClient, _data: AnyObject ) => {
      await client.query(
        `INSERT INTO context (uuid, context) VALUES ($1, $2) ON CONFLICT ON CONSTRAINT context_pkey DO NOTHING;`,
        [
          _data.__context.__id,
          _data.__context.__context
        ],
      );

      await client.query(
        `UPDATE routine_execution AS re SET is_running = FALSE, is_complete = TRUE, progress = 1.00, ended = $1, result_context_id = $2 WHERE re.uuid = $3;`,
        [ this.formatTimestamp( _data.__executionStart + _data.__executionTime ), _data.__context.__id, _data.__graphId ],
      );

      return _data;
    } );

    this.forwardToServer( 'Updated graph completed state on database', updatedData );
  }

  async addNode( data: AnyObject ) {
    if ( this.readOnly ) {
      return;
    }

    const updatedData = await this.makeTransaction( data, async ( client: PoolClient, _data: AnyObject ) => {
      await client.query(
        `INSERT INTO context (uuid, context) VALUES ($1, $2) ON CONFLICT ON CONSTRAINT context_pkey DO NOTHING;`,
        [
          _data.__context.__id,
          _data.__context.__context
        ],
      );

      await client.query(
        `INSERT INTO task_execution(uuid, routine_execution_id, task_id, context_id, split_group, created) VALUES ($1, $2, $3, $4, $5, $6) 
         ON CONFLICT ON CONSTRAINT task_execution_pkey DO NOTHING;`,
        [ _data.__id, _data.__graphId, _data.__task.__id, _data.__context.__id, _data.__splitGroupId, this.formatTimestamp( _data.__scheduled ) ],
      );

      for ( const prevId of data.__previousNodes ) {
        await client.query(
          `INSERT INTO task_execution_map(task_execution_id, previous_task_execution_id) VALUES ($1, $2) 
           ON CONFLICT ON CONSTRAINT task_execution_map_pkey DO NOTHING;`,
          [ _data.__id, prevId ],
        );
      }

      return _data;
    } );

    this.forwardToServer( 'Node added to database', updatedData );
  }

  async runningNode( data: AnyObject ) {
    if ( this.readOnly ) {
      return;
    }

    if ( data.__isUnique ) {
      await this.query(
        `INSERT INTO context (uuid, context) VALUES ($1, $2) ON CONFLICT ON CONSTRAINT context_pkey DO NOTHING;`,
        [ data.__context.__id, data.__context.__context ],
      );
    }

    await this.query(
      `UPDATE task_execution AS te SET is_running = TRUE, started = $1, context_id = $2 WHERE te.uuid = $3;`,
      [ this.formatTimestamp( data.__executionStart ), data.__context.__id, data.__id ],
    );

    this.forwardToServer( 'Updated node running state on database', data );
  }

  async nodeProgressUpdate( data: AnyObject ) {
    if ( this.readOnly ) {
      return;
    }

    this.forwardToServer( 'Updated node progress on database', data );
  }

  async nodeErrored( data: AnyObject ) {
    if ( this.readOnly ) {
      return;
    }

    const updatedData = await this.makeTransaction( data, async ( client: PoolClient, _data: AnyObject ) => {
      await client.query(
        `INSERT INTO context (uuid, context)
         VALUES ($1, $2)
         ON CONFLICT ON CONSTRAINT context_pkey DO NOTHING;`,
        [ _data.__context.__id, _data.__context.__context ],
      );

      await client.query(
        `UPDATE task_execution AS te
         SET errored = $1,
             failed = $2,
             result_context_id = $3,
             error_message = $4
         WHERE te.uuid = $5;`,
        [ !!_data.__errored, !!_data.__failed, _data.__context.__id, _data.__error || null, _data.__id ],
      );

      return _data;
    } );

    this.forwardToServer( 'Updated node errored state on database', updatedData );
  }

  async nodeComplete( data: AnyObject ) {
    if ( this.readOnly ) {
      return;
    }

    const updatedData = await this.makeTransaction( data, async ( client: PoolClient, _data: AnyObject ) => {
      await client.query(
        `INSERT INTO context (uuid, context)
         VALUES ($1, $2)
         ON CONFLICT ON CONSTRAINT context_pkey DO NOTHING;`,
        [ _data.__context.__id, _data.__context.__context ],
      );

      await client.query(
        `UPDATE task_execution AS te
         SET is_running = FALSE,
             is_complete = TRUE,
             progress = 1.00,
             ended = $1,
             result_context_id = $2
         WHERE te.uuid = $3;`,
        [ this.formatTimestamp( _data.__executionStart + _data.__executionTime ), _data.__context.__id, _data.__id ],
      );

      return _data;
    } );

    this.forwardToServer( 'Updated node completed status on database', updatedData );
  }

  private formatTimestamp( timestamp: number ) {
    return new Date( timestamp ).toISOString();
  }

}
