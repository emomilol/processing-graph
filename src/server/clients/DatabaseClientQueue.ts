import { AnyObject } from '../../../types/global';


type ActionFunction = ( data: AnyObject ) => Promise<void>;

export default class DatabaseClientQueue {
  private queues: { [ id: string ]: [ ActionFunction, AnyObject ][] } = {};
  private idsProcessing: string[] = [];

  add( action: ActionFunction, data: AnyObject, id: string ) {
    this.queues[ id ] ??= [];
    this.queues[ id ].push( [ action, data ] );
    this.processQueue();
  }

  private processQueue() {
    for ( const id of Object.keys( this.queues ) ) {
      if ( !this.idsProcessing.includes( id ) ) {
        this.idsProcessing.push( id );
        this.processId( id );
      }
    }
  }

  private processId( id: string ) {
    const promise = this.queues[ id ].shift();
    if ( promise ) {
      this.process( promise, id ).then( graphId => this.processId( graphId ) );
    } else {
      this.idsProcessing.splice( this.idsProcessing.indexOf( id ), 1 );
      delete this.queues[ id ];
    }
  }

  private async process( promise: [ ActionFunction, AnyObject ], id: string ) {
    await promise[ 0 ]( promise[ 1 ] );
    return id;
  }

}
