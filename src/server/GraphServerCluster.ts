import cluster from 'cluster';
import os from 'os';
import process from 'process';

export default class GraphServerCluster {
  private static instance_: GraphServerCluster;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new GraphServerCluster();
    }

    return this.instance_;
  }

  private environment: {
    PORT: string,
    URL: string,
  } = {
    PORT: process.env.PORT ?? '3000',
    URL: process.env.URL ?? 'localhost',
  };
  private timeouts: { [ pid: number ]: NodeJS.Timeout } = {};

  protected constructor() {}

  setSharedEnvironment( environment: {
    PORT: string,
    URL: string,
  } ) {
    this.environment = environment;
  }

  setupPrimary() {
    console.log(`Primary ${ process.pid } is running`);
    this.initMessageHandlers();

    for ( let i = 0; i < 3; i++ ) {
      cluster.fork( this.environment );
    }
  }

  initMessageHandlers() {
    cluster.on( 'exit', ( worker: any, code: number, signal: string ) => {
      console.log('worker %d died (%s). restarting...',
        worker.process.pid, signal || code);

      GraphServerCluster.connectionError();

      if ( worker.exitedAfterDisconnect ) {
        console.log('Oh, it was just voluntary – no need to worry');
        return;
      }

      cluster.fork( this.environment );
    } );

    cluster.on( 'disconnect', ( worker: any ) => {
      console.log( `The worker #${ worker.id } has disconnected` );
    } );

    cluster.on( 'fork', ( worker: any ) => {
      this.timeouts[ worker.id ] = setTimeout( GraphServerCluster.connectionError, 2000 );
    } );

    cluster.on( 'online', ( worker: any ) => {
      console.log( `Yay, the worker ${ worker.id } responded after it was forked` );
    } );

    cluster.on( 'listening', ( worker: any, address: { address: string, port: number }, addressType: string ) => {
      console.log( `A worker is now connected to ${ address.address }:${ address.port } of type: ${ addressType }` );
      clearTimeout( this.timeouts[ worker.id ] );
      delete this.timeouts[ worker.id ];
    } );
  }

  static isPrimary() {
    return cluster.isPrimary;
  }

  static isWorker() {
    return cluster.isWorker;
  }

  static numberOfCores() {
    return os.cpus().length;
  }

  static connectionError() {
    console.error( 'There seems to be some connection error...' );
  }
}
