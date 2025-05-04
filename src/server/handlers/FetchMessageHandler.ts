import MessageHandler from '../../interfaces/MessageHandler';
import GraphServerClient from '../../interfaces/GraphServerClient';
import { AnyObject } from '../../types/global';
import EventBroker from '../../interfaces/EventBroker';
import FetchClient from '../clients/FetchClient';


export default class FetchMessageHandler extends MessageHandler {
  private static instance_: FetchMessageHandler;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new FetchMessageHandler();
    }

    return this.instance_;
  }

  private constructor() {
    super();
  }

  canHandleMessage( from: GraphServerClient ): boolean {
    return from instanceof FetchClient;
  }

  handleMessage( message: string, data: AnyObject, server: EventBroker ) {
    switch ( message ) {
      case 'Server overloaded':
        server.dispatch( data, 'deputyManager', 'resolveDeputyTask' );
        break;

      case 'Remote graph complete':
      case 'Remote graph errored':
      case 'Timeout error on running remote graph':
        server.dispatch( data, 'deputyManager', 'resolveDeputyTask' );
        break;

      case 'Registered server':
        server.dispatch( data, 'databaseClient', 'registerServerConnection' );
        break;

      case 'Remote server not responding':
        server.dispatch( data, 'databaseClient', 'serverNotResponding' );
        break;

      case 'Asked for update from dependee':
      case 'Running graph on remote server':
        break;

      default:
        console.error( `Message: "${ message }" from FetchClient not recognized!` );
    }
  }
}
