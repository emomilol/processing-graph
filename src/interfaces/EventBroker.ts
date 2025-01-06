import GraphServerClient from './GraphServerClient';
import MessageHandler from './MessageHandler';

export default abstract class EventBroker {
  protected handlers: MessageHandler[] = [];

  forward( message: string, data: any, from: GraphServerClient ) {
    for ( const handler of this.handlers ) {
      if ( handler.canHandleMessage( from ) ) {
        handler.handleMessage( message, data, this );
      }
    }
  }

  dispatch( data: any, to: string, action: string ) {
    const client = this.getClient( to );

    if ( client !== undefined ) {
      client.dispatch( data, action );
    }

    return false;
  }

  protected getClient( to: string ): GraphServerClient | undefined {
    let client = ( this as any )[ to ];

    if ( client instanceof GraphServerClient ) {
      return client;
    }

    return undefined;
  }
}
