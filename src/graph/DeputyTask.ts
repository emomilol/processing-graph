import { v4 as uuid } from 'uuid';
import Task, { TaskFunction } from './Task';
import GraphContext from '../context/GraphContext';
import DeputyManager from '../server/clients/DeputyManager';
import { AnyObject } from '../../types/global';
import GraphRegistry from '../GraphRegistry';
import { sleep } from '../utils/promise';

type ResolveFunction = ( value: ( PromiseLike<unknown> | unknown ) ) => void;

export default class DeputyTask extends Task {
  readonly isDeputy: boolean = true;
  private readonly deputyTaskName: string;
  private processingGraphName: string | undefined;
  private manager: DeputyManager | undefined;
  private idToResolve: { [ id: string ]: ResolveFunction } = {};
  private idToReject: { [ id: string ]: ResolveFunction } = {};

  constructor(
    task: TaskFunction,
    name: string,
    deputyTaskName: string,
    processingGraphName: string | undefined = undefined,
    description: string = '',
    unique: boolean = false,
    concurrency: number = 0,
  ) {
    super( task, name, description, unique, concurrency );
    this.deputyTaskName = deputyTaskName;
    this.processingGraphName = processingGraphName;
  }

  public process( context: GraphContext ) {
    if ( this.taskFunction && this.manager ) {
      return new Promise( ( resolve, reject ) => {
        const ctx = context.getContext();
        const metaData = context.getMetaData();
        const processId = uuid();
        this.manager?.processRemoteTask( {
          __taskName: this.deputyTaskName,
          __pgId: this.processingGraphName,
          __contractId: metaData.__contractId ?? null,
          __metaData: {
            ...metaData,
            __deputyTaskId: this.id,
            __deputyProcessId: processId,
          },
          ...ctx,
        } );

        this.taskFunction( ctx );

        this.idToResolve[ processId ] = resolve;
        this.idToReject[ processId ] = reject;
      } );
    }

    return false;
  }

  async getProcessingGraph() {
    if ( !this.processingGraphName ) {
      let globalRoutine = GraphRegistry.instance.getGlobalRoutine( this.deputyTaskName );
      if ( !globalRoutine ) {
        let retries = 30;
        while ( !globalRoutine && retries > 0 ) {
          await sleep( 1000 );
          globalRoutine = GraphRegistry.instance.getGlobalRoutine( this.deputyTaskName );
          retries--;
        }

        if ( !globalRoutine ) {
          console.log( 'No routine', this.name );
          return;
        }
      }

      this.processingGraphName = globalRoutine.processingGraph;
    }

    return this.processingGraphName;
  }

  public setManager( manager: DeputyManager ) {
    this.manager = manager;
  }

  public resolveProcess( data: AnyObject ) {
    if ( data.__error ) {
      this.idToReject[ data.__deputyProcessId ]( data );
    } else {
      this.idToResolve[ data.__deputyProcessId ]( data );
    }

    delete this.idToResolve[ data.__deputyProcessId ];
    delete this.idToReject[ data.__deputyProcessId ];
  }
}
