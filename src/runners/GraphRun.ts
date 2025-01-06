import { v4 as uuid } from 'uuid';
import GraphNode from '../graph/GraphNode';
import GraphExporter from '../interfaces/GraphExporter';
import Graph from '../interfaces/Graph';
import SyncGraphLayer from '../graph/SyncGraphLayer';
import GraphRunState from '../interfaces/GraphRunState';
import ExecutionChain from '../interfaces/ExecutionChain';


export interface RunJson {
  __id: string;
  __label: string;
  __graph: any;
  __data: any;
}

// A unique execution of the graph
export default class GraphRun extends ExecutionChain {
  readonly id: string;
  private graph: Graph | undefined;
  // @ts-ignore
  private state: GraphRunState;
  private exporter: GraphExporter | undefined;
  private progressCallback: ( event: string, data: any ) => void = ( event, data ) => {};

  constructor( state: GraphRunState ) {
    super();
    this.id = uuid();
    this.setState( state );
  }

  setProgressCallback( callback: ( event: string, data: any ) => void ) {
    this.progressCallback = callback;
  }

  setGraph( graph: Graph ) {
    this.graph = graph;
  }

  report( event: string, data: any ) {
    if ( this.progressCallback ) {
      this.progressCallback( event, data );
    }
  }

  addNode( node: GraphNode ) {
    this.state.addNode( node );
  }

  // Composite function / Command execution
  run() {
    return this.state.run();
  }

  // Composite function
  destroy() {
    this.graph?.destroy();
    this.graph = undefined;
    this.exporter = undefined;
    this.decouple();
  }

  // Composite function
  log() {
    console.log( 'vvvvvvvvvvvvvvvvv' );
    console.log( 'GraphRun' );
    console.log( 'vvvvvvvvvvvvvvvvv' );
    this.graph?.log();
    console.log( '=================' );
  }

  // Memento
  export(): RunJson {
    if ( this.exporter && this.graph ) {
      const data = this.state.export();
      return {
        __id: this.id,
        __label: data.__startTime ?? this.id,
        __graph: this.exporter.exportGraph( this.graph as SyncGraphLayer ),
        __data: data,
      };
    }

    return {
      __id: this.id,
      __label: this.id,
      __graph: undefined,
      __data: {},
    };
  }

  // Export Strategy
  setExporter( exporter: GraphExporter ) {
    this.exporter = exporter;
  }

  setState( state: GraphRunState ) {
    this.state = state;
    this.state.setContext( this );
  }
}
