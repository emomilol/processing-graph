import { v4 as uuid } from 'uuid';
import Task, { ProcessingTask } from '../graph/Task';
import GraphRun from './GraphRun';
import VueFlowExporter from '../vue-flow/VueFlowExporter';
import GraphDebugRun from './GraphDebugRun';
import GraphBuilder from '../interfaces/GraphBuilder';
import GraphStandardRun from './GraphStandardRun';
import GraphNode from '../graph/GraphNode';
import GraphContextFactory from '../context/GraphContextFactory';
import GraphBreadthFirstBuilder from '../builders/GraphBreadthFirstBuilder';
import GraphRunState from '../interfaces/GraphRunState';
import GraphRegistry from '../GraphRegistry';
import GraphServerClient from '../interfaces/GraphServerClient';
import { AnyObject } from '../../types/global';
import GraphAsyncRun from './GraphAsyncRun';
import GraphAsyncQueueBuilder from '../builders/GraphAsyncQueueBuilder';
import GraphRoutine from '../graph/GraphRoutine';

export type GraphExecutionStrategy = 'default' | 'async';

export default class GraphRunner extends GraphServerClient {
  readonly id: string;
  private nextRun: GraphRun | undefined;
  private nextStaticGraph: Task[] = [];
  private prevRuns: any[] = [];
  private debug: boolean = false;
  private isRunning: boolean = false;

  constructor( strategy: GraphExecutionStrategy = 'default' ) {
    super()
    this.id = uuid();
    this.setStrategy( strategy );
  }

  private readonly strategies: { [ key: string ]: GraphBuilder } = {
    default: new GraphBreadthFirstBuilder(),
    async: new GraphAsyncQueueBuilder(),
  };

  private readonly states: { [ key: string ]: GraphRunState } = {
    default: new GraphStandardRun( this.strategies.default ),
    debug: new GraphDebugRun( this.strategies.default ),
    async: new GraphAsyncRun( this.strategies.default ),
  };

  private currentState: GraphRunState = this.states.default;

  public addTasks( tasks: ProcessingTask | ProcessingTask[] | GraphRoutine, context: AnyObject ) {
    if ( !this.nextRun ) {
      this.nextRun = new GraphRun( this.currentState );
      this.nextRun.setProgressCallback( this.forwardToServer.bind( this ) );
    }

    let _tasks = tasks;
    let routineName;
    let routineId = null;
    if ( _tasks instanceof Task ) {
      routineName = _tasks.name;
      _tasks = [ _tasks ];

    } else if ( _tasks instanceof GraphRoutine ) {
      const routine = _tasks;
      routineName = routine.name;
      routineId = routine.id;
      _tasks = [];
      routine.forEachTask( ( task: ProcessingTask ) => {
        ( _tasks as ProcessingTask[] ).push( task );
      } );
    } else {
      routineName = ( _tasks as ProcessingTask[] ).map( t => t.name ).join( ' | ' );
    }

    _tasks = _tasks as Task[];

    this.nextStaticGraph.push( ..._tasks as Task[] );

    const ctx = GraphContextFactory.instance.getContext( context );

    const graphId = context.__graphId ?? uuid();
    const data = {
      __graphId: graphId,
      __routineName: routineName,
      __routineId: routineId,
      __context: ctx.export(),
      __previousRoutineExecution: context.__metaData?.__graphId ?? null,
      __contractId: context.__metaData?.__contractId ?? context.__contractId ?? null,
      __task: {
        __name: routineName,
      },
      __scheduled: Date.now(),
    };

    GraphRegistry.instance.updateSelf( data );
    this.forwardToServer( 'New routine execution', data );

    for ( const task of _tasks as Task[] ) {
      this.nextRun.addNode( new GraphNode( task as Task, ctx, graphId ) );
    }
  }

  public run( tasks?: ProcessingTask | ProcessingTask[] | GraphRoutine, context?: AnyObject ) {
    if ( tasks ) {
      this.addTasks( tasks, context ?? {} );
    }

    if ( this.isRunning ) {
      return;
    }

    if ( this.nextRun ) {
      this.isRunning = true;
      this.nextRun.run();
    }

    this.reset();
  }

  public async runAsync( tasks?: ProcessingTask | ProcessingTask[] | GraphRoutine, context?: AnyObject ) {
    if ( tasks ) {
      this.addTasks( tasks, context ?? {} );
    }

    if ( this.isRunning ) {
      return;
    }

    if ( this.nextRun ) {
      this.isRunning = true;
      await this.nextRun.run();
    }

    this.reset();
  }

  private reset() {
    if ( this.debug && this.nextRun ) {
      this.saveRun( this.nextRun );
    }

    this.isRunning = false;

    GraphContextFactory.instance.reset();

    this.nextRun = undefined;
  }

  public setDebug( value: boolean ) {
    this.debug = value;
  }

  public setState( state: string ) {
    this.currentState = this.states[ state ];

    if ( state === 'debug' ) {
      this.setDebug( true );
    }

    if ( this.nextRun ) {
      this.nextRun.setState( this.currentState );
    }
  }

  public setStrategy( strategy: GraphExecutionStrategy ) {
    for ( const state of Object.values( this.states ) ) {
      state.changeStrategy( this.strategies[ strategy ] );
    }

    if ( strategy === 'async' ) {
      this.currentState = this.states.async;
    }
  }

  public destroy() {
    if ( this.nextRun ) {
      this.nextRun.destroy();
    }

    this.nextRun = undefined;
    this.nextStaticGraph = [];

    GraphRegistry.instance.deleteRunner( this );
  }

  private saveRun( run: GraphRun ) {
    run.setExporter( new VueFlowExporter() );
    const exporter = new VueFlowExporter();
    this.prevRuns.push( {
      ...run.export(),
      staticGraph: exporter.exportStaticGraph( this.nextStaticGraph ),
    } );
    console.log( this.prevRuns );

    // TODO: Export data to debugging tools
  }

  startRun( data: AnyObject ) {
    if ( data.__taskName ) {
      let routine: GraphRoutine | Task | undefined = GraphRegistry.instance.getRoutine( data.__taskName );
      if ( !routine ) {
        routine = GraphRegistry.instance.getTaskByName( data.__taskName );
      }

      this.runAsync( routine, data );

    } else {
      data.__error = 'No routine or task defined.';
      this.forwardToServer( 'No routine or task defined', data );
    }

    this.forwardToServer( 'Started graph run', data );
  }
}
