import * as http from 'http';
import { RequestListener, Server } from 'http';
import EventBroker from '../interfaces/EventBroker';
import ProcessingGraph from '../graph/ProcessingGraph';
import MessageHandler from '../interfaces/MessageHandler';
import RestMessageHandler from './handlers/RestMessageHandler';
import RunnerMessageHandler from './handlers/RunnerMessageHandler';
import SocketMessageHandler from './handlers/SocketMessageHandler';
import RestAPI from './clients/RestAPI';
import FetchClient from './clients/FetchClient';
import FetchMessageHandler from './handlers/FetchMessageHandler';
import Joi, { ObjectSchema } from 'joi';
import DeputyMessageHandler from './handlers/DeputyMessageHandler';
import SocketServer from './clients/SocketServer';
import SocketClient from './clients/SocketClient';
import DeputyManager from './clients/DeputyManager';
import DatabaseClient from './clients/DatabaseClient';
import DatabaseMessageHandler from './handlers/DatabaseMessageHandler';
import GraphRunner from '../runners/GraphRunner';
import GraphServerCluster from './GraphServerCluster';


export interface ServerOptions {
  loadBalance?: boolean;
  useSocket?: boolean;
  log?: boolean;
}

export default class GraphServer extends EventBroker {
  private static instance_: GraphServer;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new GraphServer();
    }

    return this.instance_;
  }

  protected port: string | number = process.env.PG_GRAPH_SERVER_PORT || 3000;
  protected address: string = process.env.PG_GRAPH_SERVER_URL || 'localhost';
  protected processPid: number = process.pid;
  protected server: Server | undefined;
  protected schema: ObjectSchema;

  protected runner: GraphRunner;
  protected restApi: RestAPI;
  protected fetchClient: FetchClient | undefined;
  protected socketServer: SocketServer | undefined;
  protected socketClient: SocketClient | undefined;
  protected deputyManager: DeputyManager | undefined;
  protected databaseClient: DatabaseClient | undefined;

  private serverCreated: boolean = false;
  private identity: string = '';
  private processingGraphDescription: string = '';

  private loadBalance: boolean = true;
  private useSocket: boolean = true;
  private log: boolean = false;

  protected handlers: MessageHandler[] = [
    RunnerMessageHandler.instance,
    FetchMessageHandler.instance,
    SocketMessageHandler.instance,
    RestMessageHandler.instance,
    DatabaseMessageHandler.instance,
    DeputyMessageHandler.instance,
  ];

  private constructor() {
    super();
    this.runner = ProcessingGraph.createRunner( 'async' );
    this.runner.connectToServer( this );

    this.schema = Joi.object( {
      __graphId: Joi.string().empty().required(),
      __forceRun: Joi.boolean(),
    } ).unknown( true );

    this.restApi = RestAPI.instance;
    this.restApi.connectToServer( this );
    this.restApi.setSchema( this.schema );
  }

  getServer() {
    return this.server;
  }

  setPort( port: number ) {
    this.port = port;
  }

  start() {
    if ( this.server ) {
      let port = this.port;
      if ( GraphServerCluster.isWorker() ) {
        port = 0;
      }
      this.server.listen( port, () => {
        if ( typeof this.server?.address() === 'string' ) {
          this.address = ( this.server.address() as string );
          // @ts-ignore
        } else if (this.server?.address()?.address === '::') {
          if (process.env.NODE_ENV === 'development') {
            this.address = 'localhost';
          } else if (process.env.IS_DOCKER === 'true') {
            this.address = process.env.PG_GRAPH_SERVER_URL || 'localhost';
          }
        } else {
          // @ts-ignore
          this.address = ( this.server?.address()?.address || '' );
        }
        console.log( `Server is running on ${ this.address }:${ this.port }` );
        this.init();
      } );

    }
  }

  setIdentity( name: string, description: string ) {
    if ( !this.identity ) {
      this.identity = name;
      this.processingGraphDescription = description;
    }
  }

  setOptions( options: ServerOptions ) {
    this.loadBalance = options.loadBalance ?? this.loadBalance;
    this.useSocket = options.useSocket ?? this.useSocket;
    this.log = options.log ?? this.log;
  }

  protected init() {
    this.databaseClient = DatabaseClient.instance;
    this.databaseClient.connectToServer( this );

    this.fetchClient = FetchClient.instance;
    this.fetchClient.connectToServer( this );

    if ( this.useSocket ) {
      this.fetchClient.setPrioritizeSocket( true );

      this.socketServer = SocketServer.instance;
      this.socketServer.connectToServer( this );
      this.socketServer.setSchema( this.schema );

      this.socketClient = SocketClient.instance;
      this.socketClient.connectToServer( this );
    }

    this.deputyManager = DeputyManager.instance;
    this.deputyManager.connectToServer( this );
    this.deputyManager.setLoadBalance( this.loadBalance );

    this.dispatch( {}, 'databaseClient', 'getServers' );

    this.dispatch( {
      __name: this.identity,
      __description: this.processingGraphDescription,
      __address: this.address,
      __port: this.port,
      __pid: this.processPid,
      __isPrimary: GraphServerCluster.isPrimary(),
    }, 'databaseClient', 'addServer' );

    this.dispatch( {}, 'databaseClient', 'getRoutines' );

    this.schedule();
  }

  schedule() {
    setInterval( () => {
      this.dispatch( {}, 'databaseClient', 'getDeputyServers' );
      this.dispatch( {}, 'databaseClient', 'getRoutines' );
      this.dispatch( {}, 'databaseClient', 'getSelf' );
    }, 30000 );
  }

  createServer( app: RequestListener ) {
    if ( !this.serverCreated ) {
      this.server = http.createServer( app );
      this.serverCreated = true;
    }
  }
}
