import { v4 as uuid } from 'uuid';
import GraphServerClient from '../../interfaces/GraphServerClient';
import { AnyObject } from '../../types/global';
import DeputyTask from '../../graph/DeputyTask';
import GraphRegistry, { DeputyDescriptor } from '../GraphRegistry';
import LoadBalancer from '../../utils/LoadBalancer';


export default class DeputyManager extends GraphServerClient {
  private static instance_: DeputyManager;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new DeputyManager();
    }

    return this.instance_;
  }

  private loadBalancer: LoadBalancer;

  protected constructor() {
    super();
    this.loadBalancer = new LoadBalancer();
  }

  private deputyTasks: Map<string, DeputyTask> = new Map<string, DeputyTask>();

  setLoadBalance( value: boolean ) {
    this.loadBalancer.setLoadBalance( value );
  }

  addDeputyTask( data: AnyObject ) {
    if ( !this.deputyTasks.has( data.__task.id ) ) {
      this.deputyTasks.set( data.__task.id, data.__task );
      data.__task.setManager( this );
      delete data.__task;
      this.forwardToServer( 'Added deputy task to manager', data );
    }
  }

  addDeputyTasks( data: AnyObject ) {
    GraphRegistry.instance.forEachDeputy( async ( deputy: DeputyDescriptor ) => {
      const task = GraphRegistry.instance.getTaskByName( `Deputy task for "${ deputy.name }"` );
      if ( task ) {
        this.addDeputyTask( { __taskName: deputy.name, __task: task } );
      }
    } );

    this.forwardToServer( 'Added deputy tasks to manager', data );
  }

  processRemoteTask( data: AnyObject ) {
    if ( data.__isActive === false ) {
      return;
    }

    const processedData = this.loadBalancer.selectServer( data );
    if ( !processedData.__serverId ) {
      data.__error = 'No server available';
      this.resolveDeputyTask( data ); // TODO Wait until the server is available?
      return;
    }

    if ( !processedData.__context.__graphId ) {
      processedData.__context.__graphId = uuid();
    }

    this.forwardToServer( 'Process remote task', processedData );
  }

  resolveDeputyTask( data: AnyObject ) {
    if ( this.deputyTasks.has( data.__deputyTaskId ) ) {
      const task = this.deputyTasks.get( data.__deputyTaskId );
      if ( task ) {
        task.resolveProcess( data );
        this.forwardToServer( 'Resolved deputy task', data );
      }
    }
  }
}
