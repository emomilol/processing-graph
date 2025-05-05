import Task from '../graph/Task';
import GraphRunner from '../runners/GraphRunner';
import { AnyObject } from '../types/global';
import GraphRoutine from '../graph/GraphRoutine';
import DeputyTask from '../graph/DeputyTask';


interface GraphDescriptor {
  graphId: string;
  taskName: string;
}

interface ServerDescriptor {
  id: string;
  address: string;
  port: number;
  pid: number;
  processingGraphId: string;
  runningGraphs: GraphDescriptor[];
  cpu?: number;
  ram?: number;
  active: boolean;
  tasks: string[];
  routines: string[];
  isDeputy: boolean;
}

export interface RoutineDescriptor {
  name: string;
  processingGraph: string;
}

export interface DeputyDescriptor {
  name: string;
  task: DeputyTask;
}

export default class GraphRegistry {
  private static instance_: GraphRegistry;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new GraphRegistry();
    }

    return this.instance_;
  }

  private tasks: Task[] = [];
  private routines: GraphRoutine[] = [];
  private runners: GraphRunner[] = [];

  private deputies: DeputyDescriptor[] = [];
  private globalRoutines: RoutineDescriptor[] = [];

  private self: ServerDescriptor = {
    id: '',
    address: '',
    port: 3000,
    pid: 0,
    processingGraphId: '',
    runningGraphs: [],
    cpu: 0.0,
    ram: 0.0,
    active: false,
    tasks: [],
    routines: [],
    isDeputy: false,
  };

  private servers: Map<string, ServerDescriptor> = new Map();

  private constructor() {}

  getTaskByName( name: string ) {
    return this.tasks.find( t => t.name === name );
  }

  hasDeputies() {
    return !!this.deputies.length;
  }

  getTaskById( id: string ) {
    return this.tasks.find( t => t.id === id );
  }

  forEachTask( callback: ( task: Task ) => void ) {
    for ( const task of this.tasks ) {
      callback( task );
    }
  }

  forEachDeputy( callback: ( deputy: DeputyDescriptor ) => void ) {
    for ( const deputy of this.deputies ) {
      callback( deputy );
    }
  }

  forEachRoutine( callback: ( routine: GraphRoutine ) => void ) {
    for ( const routine of this.routines ) {
      callback( routine );
    }
  }

  getRoutine( routineName: string ): GraphRoutine | undefined {
    return this.routines.find( r => r.name === routineName );
  }

  getGlobalRoutine( routineName: string ): RoutineDescriptor | undefined {
    return this.globalRoutines.find( r => r.name === routineName );
  }

  getRunnerById( id: string ) {
    return this.runners.find( r => r.id === id );
  }

  getDeputy( name: string ) {
    return this.deputies.find( d => d.name === name );
  }

  registerTask( task: Task ) {
    this.tasks.push( task );
    this.self.tasks.push( task.name );
  }

  registerDeputy( deputy: DeputyDescriptor ) {
    this.deputies.push( deputy );
  }

  registerRoutine( routine: GraphRoutine ) {
    this.routines.push( routine );
    this.self.routines.push( routine.name );
  }

  registerGlobalRoutine( routine: RoutineDescriptor ) {
    if ( !this.getGlobalRoutine( routine.name ) ) {
      this.globalRoutines.push( routine );
    }
  }

  registerRunner( runner: GraphRunner ) {
    this.runners.push( runner );
  }

  deleteTask( task: Task ) {
    this.delete( task, this.tasks );
  }

  deleteRoutine( routine: GraphRoutine ) {
    this.delete( routine, this.routines );
  }

  deleteRunner( runner: GraphRunner ) {
    this.delete( runner, this.runners );
  }

  private delete( instance: any, from: any[] ) {
    from.splice( from.indexOf( instance ), 1 );
  }

  registerServer( data: AnyObject ) {
    if ( !this.servers.has( data.__serverId ) ) {
      this.servers.set( data.__serverId, {
        id: data.__serverId ?? '',
        address: data.__address ?? '',
        port: data.__serverPort ?? 3000,
        pid: data.__pid ?? 0,
        processingGraphId: data.__pgId ?? '',
        runningGraphs: [],
        active: data.__isActive,
        tasks: data.__tasks ?? [],
        routines: data.__routines ?? [],
        isDeputy: data.__isDeputy ?? false,
      } );
    }
  }

  updateSelf( data: AnyObject ) {
    this.updateServer( this.self, data );
  }

  checkSelf() {
    return this.isOverloaded( this.self );
  }

  getSelfStatus() {
    if ( this.self.id ) {
      const data: AnyObject = {};
      data.__serverId = this.self.id;
      data.__address = this.self.address;
      data.__pgId = this.self.processingGraphId;
      data.__active = this.self.active;
      data.__runningGraphs = this.self.runningGraphs;
      return data;
    }

    return undefined;
  }

  private isOverloaded( server: any ) {
    if ( !server ) {
      return false;
    }

    return server.cpu > 0.99 || server.ram > 200000.0 || server.runningGraphs.length > 100;
  }

  isServerOverloaded( id: string ) {
    return this.isOverloaded( this.getServerById( id ) );
  }

  isServerActive( id: string ) {
    return !!this.getServerById( id )?.active;
  }

  private updateServer( server: ServerDescriptor, data: AnyObject ) {
    server.active = true;

    if ( !server.id && data.__serverId ) {
      server.id = data.__serverId;
    }

    if ( !server.address && data.__address ) {
      server.address = data.__address;
      server.port = data.__port;
    }

    if ( !server.processingGraphId && data.__pgId ) {
      server.processingGraphId = data.__pgId;
    }

    if ( data.__runningGraphs !== undefined ){
      server.runningGraphs = data.__runningGraphs;

    } else if ( data.__graphId ) {
      const graphIndex = server.runningGraphs.findIndex( g => g.graphId === data.__graphId );
      if ( data.__task?.__name && graphIndex < 0 && !data.__graphComplete ) {
        server.runningGraphs.push( {
          graphId: data.__graphId,
          taskName: data.__task?.__name,
        } );

      } else if ( graphIndex >= 0 && data.__graphComplete ) {
        server.runningGraphs.splice( graphIndex, 1 );
      }
    }

    if ( data.__tasks ) {
      server.tasks = data.__tasks;
    }

    if ( data.__cpu !== undefined && data.__ram !== undefined ) {
      server.cpu = data.__cpu;
      server.ram = data.__ram;
    }
  }

  updateRemoteServer( data: any ) {
    const server = this.getServerById( data.__serverId );
    if ( server ) {
      this.updateServer( server, data );
    }
  }

  getServerById( id: string ): ServerDescriptor | undefined {
    return this.servers.get( id );
  }

  getServerIdsByProcessingGraphId( id: string ) {
    const servers = [];
    for ( const [ serverId, server ] of this.servers ) {
      if ( server.processingGraphId === id ) {
        servers.push( serverId );
      }
    }

    return servers;
  }

  reset() {
    this.tasks = [];
    this.runners = [];
    this.deputies = [];
    this.servers = new Map();
  }
}
