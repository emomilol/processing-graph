import { AnyObject } from '../types/global';
import GraphRegistry from '../server/GraphRegistry';


export default class LoadBalancer {

  private loadBalance: boolean = true;
  public setLoadBalance( value: boolean ) {
    this.loadBalance = value;
  }

  public selectServer( data: AnyObject = {} ) {
    data.__serverCandidates = GraphRegistry.instance.getServerIdsByProcessingGraphId( data.__pgId );

    if ( !data.__serverCandidates ) {
      return data;
    }

    if ( !data.__triedServers ) {
      data.__triedServers = [];
    }

    if ( !this.loadBalance ) {
      const serverId = data.__serverCandidates[ 0 ];
      if ( !data.__triedServers.includes( serverId ) ) {
        data.__forceRun = true;
        data.__triedServers.push( serverId );

        return {
          __serverId: serverId,
          __context: data,
        };
      }

      return data;
    }

    const servers = data.__serverCandidates.sort( ( s1: string, s2: string ) => {
      const server1 = GraphRegistry.instance.getServerById( s1 );
      const server2 = GraphRegistry.instance.getServerById( s2 );
      if ( server1 && server2 ) {
        return server1.runningGraphs.length - server2.runningGraphs.length;
      }

      return 0;
    } );

    for ( const id of servers ) {
      if (
        GraphRegistry.instance.isServerActive( id )
        && !GraphRegistry.instance.isServerOverloaded( id ) // if not overloaded
        && ( !data.__triedServers || !data.__triedServers?.includes( id ) ) // if not tried before
      ) {
        data.__triedServers.push( id );

        return {
          __serverId: id,
          __context: data,
        };
      }
    }

    // if all are overloaded...
    for ( const id of servers ) {
      if ( !data.__triedServers || !data.__triedServers.includes( id ) ) {
        data.__forceRun = true;
        data.__triedServers.push( id );

        return {
          __serverId: id,
          __context: data,
        };
      }
    }

    return data;
  }
}
