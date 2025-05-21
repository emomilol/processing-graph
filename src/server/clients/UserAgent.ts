import GraphServerClient from '../../interfaces/GraphServerClient';
import { AnyObject } from '../../types/global';
import ProcessingGraph from '../../graph/ProcessingGraph';
import { v4 as uuid } from 'uuid';
import GraphContextFactory from '../../context/GraphContextFactory';
import DeputyTask from '../../graph/DeputyTask';

type ResolveFunction = ( value: AnyObject | PromiseLike<AnyObject> ) => void;

export default class UserAgent extends GraphServerClient {
  private id: string = '';
  private name: string = 'Processing graph agent';
  private description: string = '';
  private contractToRecordedPromise: { [ id: string ]: ResolveFunction } = {};
  private idToResolve: { [ id: string ]: ResolveFunction } = {};
  private idToContractId: { [ id: string ]: string } = {};

  setIdentity( data: AnyObject ) {
    this.id = data.__agentId ?? '';
  }

  getName() {
    return this.name;
  }

  setName( name: string ) {
    this.name = name;
  }

  getDescription() {
    return this.description;
  }

  setDescription( description: string ) {
    this.description = description;
  }

  onContractRecorded( data: AnyObject ) {
    this.contractToRecordedPromise[ data.__contractId ]?.( data );
    delete this.contractToRecordedPromise[ data.__contractId ];
  }

  async createContract( name: string, context: AnyObject ): Promise<AnyObject> {
    const contractIssueTime = Date.now();
    const contractId = uuid();

    this.forwardToServer( 'Agent received request', {
      __contractId: contractId,
      __agentId: this.id,
      __name: name,
      __context: context,
      __contextId: uuid(),
      __contractIssueTime: contractIssueTime,
    } );

    const contractRecordedPromise = new Promise<AnyObject>( async ( resolve) => {
      this.contractToRecordedPromise[ contractId ] = resolve;
    } );

    const request = name.split( ':' );

    let processingGraph;
    let routine;

    if ( request.length > 1 ) {
      processingGraph = request[ 0 ];
      routine = request[ 1 ];

    } else {
      routine = name;
    }

    const processId = uuid();
    this.idToContractId[ processId ] = contractId;

    const deputy: DeputyTask = ProcessingGraph.createDeputyTask( routine, processingGraph );
    await deputy.getProcessingGraph();

    this.forwardToServer( 'Agent added deputy task', { __task: deputy } );

    const ctx = {
      ...context,
      __taskName: `Deputy task for "${ routine }"`,
      __userProcessId: processId,
      __isClient: true,
      __contractId: contractId,
      __agentId: this.id,
    };

    await contractRecordedPromise;

    this.forwardToServer( 'Agent issued new contract', ctx );

    return new Promise( ( resolve, reject ) => {
      this.idToResolve[ processId ] = resolve;
    } );
  }

  resolveProcess( data: AnyObject ) {
    const context = GraphContextFactory.instance.getContext( data );
    const result = context.getContext();

    this.idToResolve[ data.__userProcessId ]( result );

    data.__contractId = this.idToContractId[ data.__userProcessId ];
    data.__contractFulfilledTime = Date.now();
    data.__context = result;
    data.__contextId = context.id;
    this.forwardToServer( 'Resolved process', data );

    delete this.idToResolve[ data.__userProcessId ];
    delete this.idToContractId[ data.__userProcessId ];
  }
}
