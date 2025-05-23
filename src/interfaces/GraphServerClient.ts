import { AnyObject } from '../types/global';
import EventBroker from './EventBroker';


export default abstract class GraphServerClient {
  protected server: EventBroker | undefined;

  protected forwardToServer( event: string, data: any ) {
    console.log( event, data );
    this.server?.forward( event, data, this );
  }

  connectToServer( server: EventBroker | undefined ) {
    if ( server === undefined ) {
      console.warn( 'Server not set on client!', this );
      return;
    }
    this.server = server;
  }

  dispatch( data: AnyObject, action: string ) {
    return ( this as any )[ action ]( data );
  }
}
