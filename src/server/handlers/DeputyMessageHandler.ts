import MessageHandler from '../../interfaces/MessageHandler';
import GraphServerClient from '../../interfaces/GraphServerClient';
import { AnyObject } from '../../types/global';
import EventBroker from '../../interfaces/EventBroker';
import DeputyManager from '../clients/DeputyManager';


export default class DeputyMessageHandler extends MessageHandler {
  private static instance_: DeputyMessageHandler;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new DeputyMessageHandler();
    }

    return this.instance_;
  }

  private constructor() {
    super();
  }

  canHandleMessage( from: GraphServerClient ): boolean {
    return from instanceof DeputyManager;
  }

  handleMessage( message: string, data: AnyObject, server: EventBroker ) {
    switch ( message ) {
      case 'Process remote task':
        server.dispatch( data, 'fetchClient', 'runGraph' );
        server.dispatch( data, 'socketClient', 'runGraph' );
        break;

      case 'Added deputy tasks to manager':
        server.dispatch( data, 'databaseClient', 'getDeputyServers' );
        break;

      case 'Resolved deputy task':
        server.dispatch( data, 'userAgentManager', 'resolveProcess' );
        break;

      case 'Added deputy task to manager':
        break;

      default:
        console.error( `Message: "${ message }" from DeputyManager not recognized!` );

    }
  }
}
