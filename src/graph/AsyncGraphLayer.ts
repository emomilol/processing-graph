import GraphNode from './GraphNode';
import GraphLayer from '../interfaces/GraphLayer';
import GraphRegistry from '../server/GraphRegistry';


export default class AsyncGraphLayer extends GraphLayer {

  process() {
    this.start();

    const result: (Promise<GraphNode[]> | GraphNode[])[][] = [];

    const nextNodesGenerator = this.getNextNodes();
    for ( const nextNodesPromises of nextNodesGenerator ) {
      result.push( nextNodesPromises );
    }

    if ( this.isProcessed() ) {
      this.end();
    }

    return result;
  }

  *getNextNodes(): Generator<(Promise<GraphNode[]> | GraphNode[])[]> {
    const taskConcurrency: GraphNode[][] = [];
    const groupedNodes: GraphNode[][] = []
    for ( const node of this.nodes ) {
      if ( node.isProcessed() ) {
        continue;
      }

      if ( node.isProcessing() ) {
        if ( node.getConcurrency() > 0 ) {
          let newTask = true;
          for ( const taskNodes of taskConcurrency ) {
            if ( taskNodes[ 0 ].sharesTaskWith( node ) ) {
              taskNodes.push( node );
              newTask = false;
              break;
            }
          }

          if ( newTask ) {
            taskConcurrency.push( [ node ] );
          }
        }
      }
    }

    for ( const node of this.nodes ) {
      if ( node.isProcessed() || node.isProcessing() ) {
        continue;
      }

      if ( node.getConcurrency() > 0 ) {
        let skip = false;
        for ( const taskNodes of taskConcurrency ) {
          if ( taskNodes[ 0 ].sharesTaskWith( node ) && taskNodes.length >= node.getConcurrency() ) {
            skip = true;
            break;
          }
        }

        if ( skip ) {
          continue;
        }
      }

      let addedToGroup = false;
      for ( const group of groupedNodes ) {
        if ( group[ 0 ].isPartOfSameGraph( node ) ) {
          group.push( node );
          addedToGroup = true;
          break;
        }
      }

      if ( !addedToGroup ) {
        groupedNodes.push( [ node ] );
      }
    }

    for ( const group of groupedNodes ) {
      yield group.map( node => this.processNode( node ) );
    }
  }

  processNode( node: GraphNode ): Promise<GraphNode[]> | GraphNode[] {
    node.start();

    const nodeBeforeState = node.lightExport()
    if ( nodeBeforeState.__previousNodes.length === 0 ) {
      this.report( 'Processing routine', nodeBeforeState );
    }

    this.report( 'Processing node', nodeBeforeState );

    const nextNodes = node.process();

    if ( nextNodes instanceof Promise ) {
      return this.processAsync( node, nextNodes );
    }

    this.postProcess( node );

    return nextNodes;
  }

  private async processAsync( node: GraphNode, nextNodes: Promise<GraphNode[]> ) {
    const result = await nextNodes;
    this.postProcess( node );
    return result;
  }

  private postProcess( node: GraphNode ) {
    const nodeData = node.lightExport();
    if ( nodeData.__errored || nodeData.__failed ) {
      this.report( 'Node errored', nodeData );
    }

    this.report( 'Node processed', nodeData );
    if ( node.graphDone() ) {
      GraphRegistry.instance.updateSelf( nodeData );
      this.report( 'Graph completed', nodeData );
    }
  }
}
