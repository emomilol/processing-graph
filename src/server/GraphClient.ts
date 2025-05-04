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
  protected userAgent: UserAgent;

  protected handlers: MessageHandler[] = [
    DatabaseMessageHandler.instance,
    UserAgentHandler.instance,
    SocketMessageHandler.instance,
    DeputyMessageHandler.instance,
    FetchMessageHandler.instance,
  ];

  protected constructor() {
    super();
    this.runner = ProcessingGraph.createRunner( 'async' );
    this.runner.connectToServer( this );

    this.userAgent = UserAgent.instance;
    this.userAgent.connectToServer( this );
  }

  private loadBalance: boolean = true;
  private useSocket: boolean = true;

  getUserAgent(): UserAgent {
    return this.userAgent;
  }

  setOptions( options: ServerOptions ) {
    this.loadBalance = options.loadBalance;
    this.useSocket = options.useSocket;
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
    }

    this.deputyManager = DeputyManager.instance;
    this.deputyManager.connectToServer( this );
    this.deputyManager.setLoadBalance( this.loadBalance );

    this.connected = true;

    this.dispatch( {}, 'databaseClient', 'getServers' );
    this.dispatch( {}, 'databaseClient', 'getRoutines' );
    this.dispatch( {
      __name: this.userAgent.getName(),
      __description: this.userAgent.getDescription(),
    }, 'databaseClient', 'addAgent' );

    this.schedule();
  }

  schedule() {
    setInterval( () => {
      this.dispatch( {}, 'databaseClient', 'getRoutines' );
    }, 30000 );
  }
}
