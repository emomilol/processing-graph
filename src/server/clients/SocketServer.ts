import { Server } from 'socket.io';
import Api from '../../interfaces/Api';
import { AnyObject } from '../../types/global';
import GraphRegistry from '../GraphRegistry';
import GraphServer from '../GraphServer';
import GraphContextFactory from '../../context/GraphContextFactory';

type Callback = ( data: any ) => any;

export default class SocketServer extends Api {
  private static instance_: SocketServer;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new SocketServer();
    }

    return this.instance_;
  }

  private io: Server | undefined;
  private adapter: ( ( nsp: any ) => any ) | undefined;
  private pendingCallbacks: { [ id: string ]: Callback } = {};

  protected constructor() {
    super();
  }

  protected createAPI() {
    if ( this.io ) {
      this.io.on( 'connection', ( socket ) => {
        console.log('A GraphServer connected');

        socket.on( 'init', ( data: AnyObject ) => {
          const status = GraphRegistry.instance.getSelfStatus();
          if ( status ) {
            this.broadcastStatus( status );
          }
          this.forwardToServer( 'New socket client connected', data );
        } );

        socket.on( 'run_graph', this.runGraph.bind( this ) );

        socket.on( 'graph_progress', ( data ) => {
          this.forwardToServer( 'Graph progress', data );
        } );

        socket.on( 'health_check', ( callback: Callback ) => {
          callback( { __status: 'ok' } );
        } );

        // Handle disconnection
        socket.on( 'disconnect', () => {
          this.forwardToServer( 'Socket client disconnected', { __socket: socket.id } );
        } );
      } );

      // TODO check if the connection comes from a confirmed server on the database.
    }
  }

  private registerCallback( callback: Callback, data: AnyObject ) {
    this.pendingCallbacks[ data.__graphId ] = callback;
  }

  connectToServer( server: GraphServer ) {
    if ( server.getServer() ) {
      this.io = new Server( server.getServer(), {} );
    } else {
      this.io = new Server( 3000, {} );
    }

    super.connectToServer( server );
    this.createAPI();
  }

  setAdapter( adapter: ( nsp: any ) => any ) {
    /// @ts-ignore
    this.adapter = adapter;
  }

  private runGraph( data: AnyObject, callback: Callback ) {
    if ( this.schema ) {
      const { error } = this.schema.validate( data );
      if ( error ) {
        callback( { __error: `Schema error: ${ error.details[0].message }` } );
        return;
      }
    }

    if ( this.pendingCallbacks[ data.__graphId ] ) {
      return;
    }

    this.registerCallback( callback, data );

    if ( !data.__forceRun && GraphRegistry.instance.checkSelf() ) {
      data.__error = 'overloaded';
      this.forwardToServer( 'Overloaded', data );
      return;
    }

    this.forwardToServer( 'Run graph', data );
  }

  private broadcastStatus( _: AnyObject ) {
    const status = GraphRegistry.instance.getSelfStatus();
    this.io?.emit( 'status', status as any );
    this.forwardToServer( 'Broadcast of my status', status );
  }

  resolveCallback( data: AnyObject ) {
    const context = GraphContextFactory.instance.getContextById( data.__context.__id );
    const metaData = context.getMetaData();
    const callback = this.pendingCallbacks[ metaData?.__graphId ];
    if ( callback ) {
      const contextData = context.getContext();
      const responseData = { ...contextData, ...( metaData.__metaData ?? metaData ) };
      callback( responseData );
      delete this.pendingCallbacks[ data.__graphId ];
      this.forwardToServer( 'Resolved socket callback', data );
    }
  }
}
