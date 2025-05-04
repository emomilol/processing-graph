import MessageHandler from '../../interfaces/MessageHandler';
import EventBroker from '../../interfaces/EventBroker';
import SocketServer from '../clients/SocketServer';
import SocketClient from '../clients/SocketClient';
import GraphServerClient from '../../interfaces/GraphServerClient';
import { AnyObject } from '../../types/global';


export default class SocketMessageHandler extends MessageHandler {
  private static instance_: SocketMessageHandler;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new SocketMessageHandler();
    }

    return this.instance_;
  }

  private constructor() {
    super();
  }

  canHandleMessage( from: GraphServerClient ): boolean {
    return from instanceof SocketServer || from instanceof SocketClient;
  }

  handleMessage( message: string, data: AnyObject, server: EventBroker ) {
    switch ( message ) {
      case 'New socket client connected':
        server.dispatch( data, 'socketClient', 'connectToSocketServer' );
        break;

      case 'Run graph':
        server.dispatch( data, 'runner', 'startRun' );
        break;

      case 'Graph progress':
        server.dispatch( data, 'socketClient', 'onGraphProgress' );
        break;

      case 'Server overloaded':
        server.dispatch( data, 'deputyManager', 'processRemoteTask' );
        break;

      case 'Remote graph complete':
      case 'Remote graph errored':
      case 'Timeout error on running remote graph':
        server.dispatch( data, 'deputyManager', 'resolveDeputyTask' );
        break;

      case 'Connected to socket server':
      case 'Received status':
      case 'Updated instance':
      case 'Broadcast of my status':
      case 'Running graph on remote server':
      case 'Performed health check on servers':
      case 'Socket client disconnected':
      case 'Disconnected from server':
      case 'Resolved socket callback':
        break;

      default:
        console.error( `Message: "${ message }" from SocketServer not recognized!` );
    }
  }
}
