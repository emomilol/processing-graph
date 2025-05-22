import FetchClient from './clients/FetchClient';
import DatabaseClient from './clients/DatabaseClient';
import EventBroker from '../interfaces/EventBroker';
import MessageHandler from '../interfaces/MessageHandler';
import FetchMessageHandler from './handlers/FetchMessageHandler';
import DatabaseMessageHandler from './handlers/DatabaseMessageHandler';
import SocketClient from './clients/SocketClient';
import SocketMessageHandler from './handlers/SocketMessageHandler';
import { ServerOptions } from './GraphServer';
import DeputyManager from './clients/DeputyManager';
import DeputyMessageHandler from './handlers/DeputyMessageHandler';
import ProcessingGraph from '../graph/ProcessingGraph';
import GraphRunner from '../runners/GraphRunner';
import UserAgent from './clients/UserAgent';
import UserAgentHandler from './handlers/UserAgentHandler';
import UserAgentManager from './clients/UserAgentManager';
import UserAgentManagerHandler from './handlers/UserAgentManagerHandler';


export default class GraphClient extends EventBroker {
  private static instance_: GraphClient;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new GraphClient();
    }

    return this.instance_;
  }

  protected connected = false;

  protected runner: GraphRunner;
  protected fetchClient: FetchClient | undefined;
  protected databaseClient: DatabaseClient | undefined;
  protected socketClient: SocketClient | undefined;
  protected deputyManager: DeputyManager | undefined;
  protected userAgentManager: UserAgentManager | undefined;

  protected handlers: MessageHandler[] = [
    DatabaseMessageHandler.instance,
    SocketMessageHandler.instance,
    FetchMessageHandler.instance,
    DeputyMessageHandler.instance,
    UserAgentHandler.instance,
    UserAgentManagerHandler.instance,
  ];

  protected constructor() {
    super();
    this.runner = ProcessingGraph.createRunner( 'async' );
    this.runner.connectToServer( this );
  }

  private loadBalance: boolean = true;
  private useSocket: boolean = true;

  createUserAgent( name: string = 'Processing graph agent', description: string = '' ): UserAgent {
    return UserAgentManager.instance.createUserAgent( name, description );
  }

  setOptions( options: ServerOptions ) {
    this.loadBalance = options.loadBalance ?? this.loadBalance;
    this.useSocket = options.useSocket ?? this.useSocket;
  }

  connect() {
    if ( this.connected ) {
      return;
    }

    this.fetchClient = FetchClient.instance;
    this.fetchClient.connectToServer( this );

    this.databaseClient = DatabaseClient.instance;
    this.databaseClient.connectToServer( this );
    this.databaseClient.setReadOnly( true );

    if ( this.useSocket ) {
      this.socketClient = SocketClient.instance;
      this.socketClient.connectToServer( this );
      this.fetchClient.setPrioritizeSocket( true );
    }

    this.deputyManager = DeputyManager.instance;
    this.deputyManager.connectToServer( this );
    this.deputyManager.setLoadBalance( this.loadBalance );

    this.userAgentManager = UserAgentManager.instance;
    this.userAgentManager.connectToServer( this );

    this.connected = true;

    this.dispatch( {}, 'databaseClient', 'getServers' );
    this.dispatch( {}, 'databaseClient', 'getRoutines' );

    this.schedule();
  }

  schedule() {
    setInterval( () => {
      this.dispatch( {}, 'databaseClient', 'getServers' );
      this.dispatch( {}, 'databaseClient', 'getRoutines' );
    }, 30000 );
  }
}
