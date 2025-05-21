import Task, { ProcessingTask, TaskFunction } from './Task';
import GraphRunner, { GraphExecutionStrategy } from '../runners/GraphRunner';
import GraphServer, { ServerOptions } from '../server/GraphServer';
import GraphRegistry from '../server/GraphRegistry';
import DeputyTask from './DeputyTask';
import GraphRoutine from './GraphRoutine';
import GraphClient from '../server/GraphClient';
import UserAgent from '../server/clients/UserAgent';
import GraphServerCluster from '../server/GraphServerCluster';


export default class ProcessingGraph {
  static createTask( func: TaskFunction, name: string, description?: string, concurrency?: number ): ProcessingTask {
    const task = new Task( func, name, description, false, concurrency );
    GraphRegistry.instance.registerTask( task );
    return task;
  }

  static createUniqueTask( func: TaskFunction, name: string, description?: string, concurrency?: number ): ProcessingTask {
    const task = new Task( func, name, description, true, concurrency );
    GraphRegistry.instance.registerTask( task );
    return task;
  }

  static createDeputyTask( name: string, processingGraph: string | undefined = undefined, concurrency: number = 0 ): DeputyTask {
    const deputy =  GraphRegistry.instance.getDeputy( name );
    if ( deputy ) {
      return deputy.task;
    }

    const task = new DeputyTask(
      ( _ ) => true,
      `Deputy task for "${ name }"`,
      name,
      processingGraph,
      `Referencing routine or task with name: "${ name }" in Processing Graph: ${ processingGraph }.`,
      false,
      concurrency,
    );

    GraphRegistry.instance.registerTask( task );
    GraphRegistry.instance.registerDeputy( { name, task: task } );
    return task;
  }

  static createRoutine( name: string, tasks: ProcessingTask[], description: string = '' ): GraphRoutine {
    const routine = new GraphRoutine( name, description, tasks );
    GraphRegistry.instance.registerRoutine( routine );
    return routine;
  }

  static createRunner( strategy: GraphExecutionStrategy = 'default' ): GraphRunner {
    const runner = new GraphRunner( strategy );
    GraphRegistry.instance.registerRunner( runner );
    return runner;
  }

  static createServer( name: string = '', description: string = '', options: ServerOptions = {
    loadBalance: false,
    useSocket: false,
    log: false,
  } ): GraphServer {
    GraphServer.instance.setIdentity( name, description );
    if ( GraphServerCluster.isWorker() && ( options.useSocket || options.loadBalance ) ) {
      options.useSocket = false;
      options.loadBalance = false;
      console.warn( 'The options "loadBalance" and "useSocket" are not available in cluster mode. Setting them to false...' );
    }
    GraphServer.instance.setOptions( options );
    return GraphServer.instance;
  }

  static createAgent( name: string = 'Processing graph agent', description: string = '', options: ServerOptions = {
    loadBalance: false,
    useSocket: false,
    log: false,
  } ): UserAgent {
    GraphClient.instance.setOptions( options );
    GraphClient.instance.connect();
    return GraphClient.instance.createUserAgent(name, description);
  }

  // static createCluster( environment: { PORT: string, URL: string } = {
  //   PORT: '3000',
  //   URL: 'localhost'
  // } ): boolean {
  //   if ( GraphServerCluster.isPrimary() ) {
  //     GraphServerCluster.instance.setSharedEnvironment( environment );
  //     GraphServerCluster.instance.setupPrimary();
  //     return true;
  //   }
  //
  //   return false;
  // }
}
