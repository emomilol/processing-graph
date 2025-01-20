import ExecutionChain from './ExecutionChain';
import Graph from './Graph';
import GraphNode from '../graph/GraphNode';
import GraphLayerIterator from '../iterators/GraphLayerIterator';
import GraphVisitor from './GraphVisitor';
import GraphContext from '../context/GraphContext';


export default abstract class GraphLayer extends ExecutionChain implements Graph {
  protected readonly index: number;
  private processing: boolean = false;
  protected nodes: GraphNode[] = [];
  private executionTime: number = 0;
  private executionStart: number = 0;

  constructor( index: number ) {
    super();
    this.index = index;
  }

  abstract process( context?: GraphContext ): unknown;

  get hasPreceding() {
    return !!this.previous && this.previous instanceof GraphLayer;
  }

  getNumberOfNodes() {
    return this.nodes.length;
  }

  isProcessed() {
    for ( const node of this.nodes ) {
      if ( !node.isProcessed() ) {
        return false;
      }
    }

    return true;
  }

  graphDone() {
    let layer: GraphLayer | undefined = this
    while ( layer ) {
      if ( layer.processing || !layer.isProcessed() ) {
        return false;
      }
      layer = layer.getNext() as GraphLayer;
    }

    return true;
  }

  setNext( next: GraphLayer ) {
    if ( next.index <= this.index ) {
      return;
    }

    if ( next.previous !== undefined ) {
      this.previous = next.previous;
    }

    super.setNext( next );
  }

  add( node: GraphNode ) {
    for ( const n of this.nodes ) {
      if ( n.isEqualTo( node ) ) {
        return;
      }

      if ( n.sharesTaskWith( node ) && n.isUnique() ) {
        n.consume( node );
        return;
      }
    }

    this.nodes.push( node );

    this.nodes.sort( ( a, b ) => {
      if ( a.id === b.id ) {
        return 0;
      } else if ( a.id > b.id ) {
        return 1;
      }

      return -1;
    } );

    this.report( 'Scheduled node', { ...node.lightExport(), __scheduled: Date.now() } );
  }

  start() {
    this.processing = true;
    if ( !this.executionStart ) {
      this.executionStart = Date.now();
    }
    return this.executionStart;
  }

  end() {
    if ( !this.executionStart ) {
      return 0;
    }

    this.processing = false;
    const end = Date.now();
    this.executionTime = end - this.executionStart;
    return end;
  }

  report( event: string, data: any ) {
    this.previous?.report( event, data );
  }

  destroy() {
    for ( const node of this.nodes ) {
      node.destroy();
    }

    this.nodes = [];

    if ( this.hasNext ) {
      const layer = this.getNext() as GraphLayer;
      layer?.destroy();
    }

    this.decouple();
  }

  getIterator(): GraphLayerIterator {
    return new GraphLayerIterator( this );
  }

  accept( visitor: GraphVisitor ) {
    visitor.visitLayer( this );

    for ( const node of this.nodes ) {
      node.accept( visitor );
    }
  }

  export() {
    return {
      __index: this.index,
      __executionTime: this.executionTime,
      __numberOfNodes: this.getNumberOfNodes(),
      __hasNextLayer: this.hasNext,
      __hasPrecedingLayer: this.hasPreceding,
      __nodes: this.nodes.map( node => node.id ),
    };
  }

  log() {
    console.log( `---Layer ${ this.index }---` );
    console.log( 'Execution time:', this.executionTime );
    let prevNode;
    for ( const node of this.nodes ) {
      if ( !prevNode || !prevNode.sharesContextWith( node ) ) {
        console.log( '**********' );
      }
      node.log();
      prevNode = node;
    }
    console.log( '***********' );
    if ( this.hasNext ) {
      ( this.getNext() as GraphLayer ).log();
    }
  }
}
