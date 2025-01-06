import MessageHandler from '../../interfaces/MessageHandler';
import RestAPI from '../clients/RestAPI';
import EventBroker from '../../interfaces/EventBroker';
import { AnyObject } from '../../../types/global';
import GraphServerClient from '../../interfaces/GraphServerClient';


export default class RestMessageHandler extends MessageHandler {
  private static instance_: RestMessageHandler;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new RestMessageHandler();
    }

    return this.instance_;
  }

  private constructor() {
    super();
  }

  canHandleMessage( from: GraphServerClient ): boolean {
    return from instanceof RestAPI;
  }

  handleMessage( message: string, data: AnyObject, server: EventBroker ) {
    switch ( message ) {
      case 'Run Graph':
        server.dispatch( data, 'runner', 'startRun' );
        break;

      case 'Responded to request':
      case 'Get Status':
      case 'Overloaded':
        break;

      default:
        throw new Error( `Message: "${ message }" from RestAPI not recognized!` );
    }
  }
}
