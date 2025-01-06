import MessageHandler from '../../interfaces/MessageHandler';
import EventBroker from '../../interfaces/EventBroker';
import GraphRunner from '../../runners/GraphRunner';
import GraphServerClient from '../../interfaces/GraphServerClient';


export default class RunnerMessageHandler extends MessageHandler {
  private static instance_: RunnerMessageHandler;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new RunnerMessageHandler();
    }

    return this.instance_;
  }

  private constructor() {
    super();
  }

  canHandleMessage( from: GraphServerClient ): boolean {
    return from instanceof GraphRunner;
  }

  handleMessage( message: string, data: any, server: EventBroker ) {
    switch ( message ) {
      case 'Scheduled node':
        server.dispatch( data, 'databaseClient', 'addNode' );
        break;

      case 'Processing node':
        server.dispatch( data, 'databaseClient', 'runningNode' );
        break;

      case 'Processing routine':
        server.dispatch( data, 'databaseClient', 'runningGraph' );
        break;

      case 'Node progress':
        server.dispatch( data, 'databaseClient', 'nodeProgressUpdate' );
        break;

      case 'Node processed':
        server.dispatch( data, 'databaseClient', 'nodeComplete' );
        // server.dispatch( data, 'databaseClient', 'graphProgressUpdate' );
        break;

      case 'New routine execution':
        server.dispatch( data, 'databaseClient', 'addRoutineExecution' );
        server.dispatch( data, 'socketServer', 'broadcastStatus' );
        break;

      case 'Graph completed':
        server.dispatch( data, 'databaseClient', 'graphComplete' );
        server.dispatch( data, 'restApi', 'json' );
        server.dispatch( data, 'socketServer', 'resolveCallback' );
        server.dispatch( data, 'socketServer', 'broadcastStatus' );
        break;

      case 'Node errored':
        server.dispatch( data, 'databaseClient', 'nodeErrored' );
        server.dispatch( data, 'databaseClient', 'graphErrored' );
        break;

      case 'No routine or task defined':
      case 'Task not found':
        server.dispatch( data, 'restApi', 'json' );
        server.dispatch( data, 'socketServer', 'resolveCallback' );
        break;

      case 'Started graph run':
      case 'Routine not found':
        break;

      default:
        throw new Error( `Message: "${ message }" from GraphRunner not recognized!` );

    }

  }
}
