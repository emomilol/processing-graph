import MessageHandler from '../../interfaces/MessageHandler';
import GraphServerClient from '../../interfaces/GraphServerClient';
import { AnyObject } from '../../types/global';
import EventBroker from '../../interfaces/EventBroker';
import UserAgentManager from '../clients/UserAgentManager';


export default class UserAgentManagerHandler extends MessageHandler {
  private static instance_: UserAgentManagerHandler;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new UserAgentManagerHandler();
    }

    return this.instance_;
  }

  private constructor() {
    super();
  }

  canHandleMessage( from: GraphServerClient ): boolean {
    return from instanceof UserAgentManager;
  }

  handleMessage( message: string, data: AnyObject, server: EventBroker ) {
    switch ( message ) {
      case 'Agent added to manager':
        server.dispatch( data, 'databaseClient', 'addAgent' );
        break;

      default:
        console.error( `Message: "${ message }" from UserAgentManager not recognized!` );
    }
  }
}
