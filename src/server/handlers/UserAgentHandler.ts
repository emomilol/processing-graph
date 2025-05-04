import MessageHandler from '../../interfaces/MessageHandler';
import GraphServerClient from '../../interfaces/GraphServerClient';
import UserAgent from '../clients/UserAgent';
import { AnyObject } from '../../types/global';
import EventBroker from '../../interfaces/EventBroker';


export default class UserAgentHandler extends MessageHandler {
  private static instance_: UserAgentHandler;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new UserAgentHandler();
    }

    return this.instance_;
  }

  private constructor() {
    super();
  }

  canHandleMessage( from: GraphServerClient ): boolean {
    return from instanceof UserAgent;
  }

  handleMessage( message: string, data: AnyObject, server: EventBroker ) {
    switch ( message ) {
      case 'Agent added deputy task':
        server.dispatch( data, 'deputyManager', 'addDeputyTask' );
        break;

      case 'Agent issued new contract':
        server.dispatch( data, 'runner', 'startRun' );
        break;

      case 'Agent received request':
        server.dispatch( data, 'databaseClient', 'addContract' );
        break;

      case 'Resolved process':
        server.dispatch( data, 'databaseClient', 'fulfillContract' );
        break;

      default:
        console.error( `Message: "${ message }" from UserClient not recognized!` );
    }
  }
}
