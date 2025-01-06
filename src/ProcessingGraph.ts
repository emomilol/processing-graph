import Task, { ProcessingTask, TaskFunction } from './graph/Task';
import GraphRunner, { GraphExecutionStrategy } from './runners/GraphRunner';
import GraphServer, { ServerOptions } from './server/GraphServer';
import GraphRegistry from './GraphRegistry';
import DeputyTask from './graph/DeputyTask';
import GraphRoutine from './graph/GraphRoutine';
import GraphClient from './server/GraphClient';
import UserAgent from './server/clients/UserAgent';
import GraphServerCluster from './server/GraphServerCluster';
import { sleep } from './utils/promise';


export default class ProcessingGraph {
  static createTask( func: TaskFunction, name: string, description?: string ): ProcessingTask {
    const task = new Task( func, name, description );
    GraphRegistry.instance.registerTask( task );
    return task;
  }

  static createUniqueTask( func: TaskFunction, name: string, description?: string ): ProcessingTask {
    const task = new Task( func, name, description, true );
    GraphRegistry.instance.registerTask( task );
    return task;
  }

  static createDeputyTask( name: string, processingGraph: string | undefined = undefined, concurrency: number = 0 ): DeputyTask {
    const deputy =  GraphRegistry.instance.getDeputy( name );
    if ( deputy ) {
      return deputy.task;
    }

    const task = new DeputyTask(
      ( context ) => true,
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

  static createRoutine( name: string, tasks: ProcessingTask[], description: string = '' ) {
    const routine = new GraphRoutine( name, description, tasks );
    GraphRegistry.instance.registerRoutine( routine );
    return routine;
  }

  static createRunner( strategy: GraphExecutionStrategy = 'default' ) {
    const runner = new GraphRunner( strategy );
    GraphRegistry.instance.registerRunner( runner );
    return runner;
  }

  static createServer( name: string = '', description: string = '', options: ServerOptions = {
    loadBalance: false,
    useSocket: false,
  } ) {
    GraphServer.instance.setIdentity( name, description );
    if ( GraphServerCluster.isWorker() && ( options.useSocket || options.loadBalance ) ) {
      options.useSocket = false;
      options.loadBalance = false;
      console.warn( 'The options "loadBalance" and "useSocket" are not available in cluster mode.' );
    }
    GraphServer.instance.setOptions( options );
    return GraphServer.instance;
  }

  static createAgent( name: string = 'Processing graph agent', description: string = '', options: ServerOptions = {
    loadBalance: false,
    useSocket: false,
  } ): UserAgent {
    GraphClient.instance.setOptions( options );
    const agent = GraphClient.instance.getUserAgent();
    agent.setName( name );
    GraphClient.instance.connect();
    return agent;
  }

  static createCluster( environment: { PORT: string, URL: string } = {
    PORT: '3000',
    URL: 'localhost'
  } ) {
    if ( GraphServerCluster.isPrimary() ) {
      GraphServerCluster.instance.setSharedEnvironment( environment );
      GraphServerCluster.instance.setupPrimary();
      return true;
    }

    return false;
  }
}
