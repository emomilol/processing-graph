import GraphServerClient from '../../interfaces/GraphServerClient';
import { AnyObject } from '../../types/global';
import GraphRegistry from '../GraphRegistry';

// The FetchAPI handles the communication over HTTP to other GraphServers REST API's.
// It initiates deputy graph executions (runs).
export default class FetchClient extends GraphServerClient {
  private static instance_: FetchClient;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new FetchClient();
    }

    return this.instance_;
  }

  // To other graph servers:
  runGraph( data: AnyObject ) {
    const server = GraphRegistry.instance.getServerById( data.__serverId );
    if ( !server ) {
      return;
    }

    GraphRegistry.instance.updateRemoteServer( {
      __serverId: data.__serverId,
      __graphId: data.__context.__graphId,
      __task: {
        __name: data.__context.__taskName,
      },
    } );

    const requestInit = {} as RequestInit;
    requestInit.headers = {
      'Content-Type': 'application/json',
    };

    requestInit.method = 'POST';

    requestInit.body = JSON.stringify( data.__context );

    fetch( `http://${ server.address }:${ server.port }/api/run_graph`, requestInit ).then( async response => {
      const responseData = await response.json();

      if ( response.status === 200 ) {
        this.forwardToServer( 'Remote graph complete', responseData );

      } else {
        if ( responseData.error ) {
          if ( responseData.error === 'overloaded' ) {
            if ( responseData.error === 'overloaded' ) {
              GraphRegistry.instance.updateRemoteServer( responseData );
              this.forwardToServer( 'Server overloaded', responseData );
            } else {
              this.forwardToServer( 'Remote graph errored', responseData );
            }
          }
        }
      }
    } ).catch( e => {
      this.forwardToServer( 'Remote server not responding', {...data, __fetchError: e.message } );
      GraphRegistry.instance.updateRemoteServer( {
        __serverId: data.__serverId,
        __graphId: data.__context.__graphId,
      } );
    } );

    this.forwardToServer( 'Running graph on remote server', data );
  }

  getStatus( data: AnyObject ) {
    // TODO Ping to see if it is alive
    this.forwardToServer( 'Asked for update from dependee', data );
  }

  registerServers( data: AnyObject ) {
    if ( !data.__servers ) {
      return;
    }

    // TODO getStatus

    for ( const server of data.__servers ) {
      GraphRegistry.instance.registerServer( {
        __serverId: server.__id,
        __address: server.__address,
        __serverPort: server.__port,
        __pgId: server.__pgId,
        __isDeputy: server.__isDeputy,
        __isActive: server.__isActive,
      } );

      this.forwardToServer( 'Registered server', server );
    }
  }

}
