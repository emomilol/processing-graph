import { io } from 'socket.io-client';
import { AnyObject } from '../../types/global';
import { Socket } from 'socket.io-client/build/esm/socket';
import GraphRegistry from '../GraphRegistry';
import GraphServerClient from '../../interfaces/GraphServerClient';


export default class SocketClient extends GraphServerClient {
  private static instance_: SocketClient;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new SocketClient();
    }

    return this.instance_;
  }

  protected constructor() {
    super();
  }

  private serverConnections: Map<string, Socket> = new Map();

  connectToServers( data: AnyObject ) {
    if ( !data.__servers ) {
      return;
    }

    for ( const server of data.__servers ) {
      this.connectToSocketServer( server );
    }
  }

  connectToSocketServer( data: AnyObject ) {
    if ( data.__isActive === false ) {
      return;
    }

    const serverId = data.__id;
    const serverAddress = data.__address;
    const serverPort = data.__port;
    const pgId = data.__pgId;
    const isDeputy = data.__isDeputy ?? false;

    if ( this.serverConnections.has( serverId ) ) {
      return;
    }

    const clientSocket = io( `ws://${ serverAddress }:${ serverPort }` );

    clientSocket.on( 'connect', () => {
      const _data = { address: serverAddress, serverId, serverPort, pgId, isDeputy: isDeputy };
      this.forwardToServer( 'Connected to socket server', _data );

      const selfStatus = GraphRegistry.instance.getSelfStatus();
      if ( selfStatus !== undefined ) {
        clientSocket.emit( 'init', {
          id: selfStatus.serverId,
          address: selfStatus.address,
          port: selfStatus.port,
          pgId,
        } );
      }
    } );

    clientSocket.on( 'status', ( _data: AnyObject ) => {
      GraphRegistry.instance.updateRemoteServer( _data );
      this.forwardToServer( 'Received status', _data );
    } );

    clientSocket.on( 'disconnect', () => {
      this.serverConnections.delete( serverId ); // Remove the client on disconnect
      this.forwardToServer( 'Disconnected from server', serverId );
    } );

    this.serverConnections.set( serverId, clientSocket );
  }

  runGraph( data: any ) {
    if ( !data.__serverId ) {
      console.log( 'No server id!' );
      return;
    }

    GraphRegistry.instance.updateRemoteServer( {
      __serverId: data.__serverId,
      __graphId: data.__context.__graphId,
      __task: {
        __name: data.__context.__taskName,
      },
    } );

    this.serverConnections.get( data.__serverId )?.timeout( 360000 ).emit(
      'run_graph',
      data.__context,
      ( ( error: string, response: any ) => {
        if ( error ) {
          GraphRegistry.instance.updateRemoteServer( {
            __serverId: data.__serverId,
            __graphId: data.__context.__graphId,
          } );

          data.__error = `Timeout error: ${ error }`;
          this.forwardToServer( 'Timeout error on running remote graph', data );
          return;
        }

        if ( response.__error ) {
          GraphRegistry.instance.updateRemoteServer( {
            __serverId: data.__serverId,
            __graphId: data.__context.__graphId,
          } );

          if ( response.__error === 'overloaded' ) {
            GraphRegistry.instance.updateRemoteServer( response );
            this.forwardToServer( 'Server overloaded', response );
          } else {
            this.forwardToServer( 'Remote graph errored', response );
          }
          return;
        }

        this.forwardToServer( 'Remote graph complete', response );
      } ) as any,
    );
    
    this.forwardToServer( 'Running graph on remote server', data );
  }

  graphProgress( data: any ) {
    this.serverConnections.get( data.__serverId )?.emit( 'graph_progress', data );
    this.forwardToServer( 'Forwarded graph progress', data );
  }

  healthCheck() {
    this.serverConnections.forEach(
      ( socket, serverId ) => socket.timeout( 1000 ).emit( 'health_check',
        ( response: { __status: string } ) => {
          if ( response?.__status !== 'ok' ) {
            this.forwardToServer( 'Server not responding', serverId );
          }
        } ) );

    this.forwardToServer( 'Performed health check on servers', { status: 'ok' } );
  }
}
