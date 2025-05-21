import GraphServerClient from '../../interfaces/GraphServerClient';
import UserAgent from './UserAgent';


export default class UserAgentManager extends GraphServerClient {
  private static instance_: UserAgentManager;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new UserAgentManager();
    }

    return this.instance_;
  }

  protected constructor() {
    super();
  }

  private agents: Map<string, UserAgent> = new Map<string, UserAgent>();

  createUserAgent( name: string = 'Processing graph agent', description: string = '' ) {
    if ( this.agents.has( name ) ) {
      return this.agents.get( name ) as UserAgent;
    }

    const agent = new UserAgent();
    agent.setName( name );
    agent.setDescription( description );
    agent.connectToServer( this.server );
    this.agents.set( name, agent );

    this.forwardToServer( 'Agent added to manager', {
      __name: name,
      __description: description,
    } );

    return agent;
  }

  setIdentity( data: any ) {
    const agent = this.agents.get( data.__name );
    if ( agent ) {
      agent.setIdentity( data );
      this.agents.set( data.__agentId, agent );
    }
  }

  onContractRecorded( data: any ) {
    const agent = this.agents.get( data.__agentId );
    if ( agent ) {
      agent.onContractRecorded( data );
    }
  }

  resolveProcess( data: any ) {
    const agent = this.agents.get( data.__agentId );
    if ( agent ) {
      agent.resolveProcess( data );
    }
  }
}
