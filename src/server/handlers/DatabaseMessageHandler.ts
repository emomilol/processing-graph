import MessageHandler from '../../interfaces/MessageHandler';
import GraphServerClient from '../../interfaces/GraphServerClient';
import FetchClient from '../clients/FetchClient';
import { AnyObject } from '../../../types/global';
import EventBroker from '../../interfaces/EventBroker';
import DatabaseClient from '../clients/DatabaseClient';


export default class DatabaseMessageHandler extends MessageHandler {
  private static instance_: DatabaseMessageHandler;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new DatabaseMessageHandler();
    }

    return this.instance_;
  }

  private constructor() {
    super();
  }

  canHandleMessage( from: GraphServerClient ): boolean {
    return from instanceof DatabaseClient;
  }

  handleMessage( message: string, data: AnyObject, server: EventBroker ) {
    switch ( message ) {
      case 'Added server to database':
        server.dispatch( data, 'databaseClient', 'addTasks' );
        break;

      case 'Added tasks to database':
        server.dispatch( data, 'databaseClient', 'addTaskConnectionMaps' );
        break;

      case 'Added task connection maps to data base':
        server.dispatch( data, 'databaseClient', 'addRoutines' );
        break;

      case 'Added routines to database':
        server.dispatch( data, 'deputyManager', 'addDeputyTasks' );
        break;

      case 'Got all routines':
        break;

      case 'Got deputy task':
        server.dispatch( data, 'deputyManager', 'addDeputyTask' );
        break;

      case 'Got deputy servers':
      case 'Got all servers':
        server.dispatch( data, 'fetchClient', 'registerServers' );
        // TODO first ping servers with fetch and then connect to socket
        server.dispatch( data, 'socketClient', 'connectToServers' );
        break;

      case 'Updated server active state on database':
        server.dispatch( data, 'deputyManager', 'processRemoteTask' );
        break;

      case 'Added agent':
        server.dispatch( data, 'userAgent', 'setIdentity' );
        break;

      case 'Got server':
      case 'Added new instance':
      case 'Error database':
      case 'Node added to database':
      case 'Contract added to database':
      case 'Contract fulfilled status updated on database':
      case 'Added routine execution to database':
      case 'Updated graph progress on database':
      case 'Updated node errored state on database':
      case 'Updated node running state on database':
      case 'Updated node progress on database':
      case 'Updated graph completed state on database':
      case 'Updated node completed status on database':
      case 'Updated graph errored status on database':
      case 'Updated server overloaded status on database':
      case 'Updated graph running status on database':
      case 'Registered server connection':
        break;

      default:
        console.error( `Message: "${ message }" from DatabaseClient not recognized!` );
    }
  }
}
