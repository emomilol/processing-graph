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

  private prioritizeSocket: boolean = false;

  setPrioritizeSocket( value: boolean ) {
    this.prioritizeSocket = value;
  }

  // To other graph servers:
  runGraph( data: AnyObject ) {
    if ( this.prioritizeSocket && !data.__forceFetch ) {
      return;
    }

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
      this.forwardToServer( 'Remote server not responding', { ...data, __fetchError: e.message } );
      GraphRegistry.instance.updateRemoteServer( {
        __serverId: data.__serverId,
        __graphId: data.__context.__graphId,
      } );
    } );

    this.forwardToServer( 'Running graph on remote server', data );
  }

  private async getStatus( server: AnyObject ): Promise<AnyObject> {
    if ( GraphRegistry.instance.isSelf( server ) ) {
      return { ...server, __isActive: true };
    }

    const response = await fetch( `http://${ server.__address }:${ server.__port }/api/status`, { method: 'GET' } ).catch( e => {
      return { status: 500 };
    } );

    if ( response.status === 200 ) {
      try {
        const responseData = await ( response as Response ).json();
        if (server.__pid !== responseData.__pid) {
          return { ...server, __isActive: false };
        }

        return { ...server, __isActive: true, __runningGraphs: responseData.__runningGraphs };
      } catch ( e ) {
        console.error('Error converting response to json', e, server);
        return { ...server };
      }
    } else {
      return { ...server, __isActive: false };
    }
  }

  registerServers( data: AnyObject ) {
    if ( !data.__servers ) {
      return;
    }

    for ( const server of data.__servers ) {
      this.getStatus( server ).then( async (serverResponse: AnyObject) => {
        const serverData = {
          __serverId: serverResponse.__id,
          __address: serverResponse.__address,
          __serverPort: serverResponse.__port,
          __pid: serverResponse.__pid,
          __pgId: serverResponse.__pgId,
          __isDeputy: serverResponse.__isDeputy,
          __isActive: serverResponse.__isActive,
        };

        if ( server.__isActive === true && serverResponse.__isActive === false ) {
          this.forwardToServer( 'Remote server not responding', serverData );
          return;
        } else if ( server.__isActive === false && serverResponse.__isActive === true ) {
          this.forwardToServer( 'Remote server reactivated', serverData );
        } else if ( server.__isActive === false && serverResponse.__isActive === false ) {
          return;
        }

        GraphRegistry.instance.registerServer( serverData );
        this.forwardToServer( 'Registered server', serverResponse );
      } );
    }
  }

}
