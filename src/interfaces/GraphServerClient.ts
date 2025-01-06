import { AnyObject } from '../../types/global';
import EventBroker from './EventBroker';
import GraphServer from '../server/GraphServer';


export default abstract class GraphServerClient {
  protected server: EventBroker | undefined;

  protected forwardToServer( event: string, data: any ) {
    console.log( event, data );
    this.server?.forward( event, data, this );
  }

  connectToServer( server: EventBroker ) {
    this.server = server;
  }

  dispatch( data: AnyObject, action: string ) {
    return ( this as any )[ action ]( data );
  }
}
