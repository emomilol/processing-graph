import GraphNode from './GraphNode';
import GraphLayer from '../interfaces/GraphLayer';
import GraphRegistry from '../server/GraphRegistry';


export default class AsyncGraphLayer extends GraphLayer {
  /*
  * The nodesQueuedByTask array is a 2D array of arrays.
  * The first dimension represents the task.
  * The second dimension separates the available nodes from the waiting nodes.
  *
  * Example:
  *
  * nodesQueuedByTask = [
  *   [ // Task 1
  *     [ // Available nodes
  *       node1,
  *       node2,
  *     ],
  *     [ // Waiting nodes
  *       node3,
  *       node4,
  *       node9,
  *       node10,
  *     ],
  *   ],
  *   [ // Task 2
  *     [ // Available nodes
  *       node5,
  *       node6,
  *     ],
  *     [ // Waiting nodes
  *       node7,
  *       node8,
  *       node11,
  *       node12,
  *     ],
  *   ]
  * ]
  *
  * The nodesQueuedByTask array is used to keep track of the nodes that are waiting to be processed.
  * */
  protected nodesQueuedByTask: GraphNode[][][] = [];
  protected nodesGroupedByGraph: { [ graphId: string ]: GraphNode[] } = {};
  protected nodeResultsGroupedByGraph: { [ graphId: string ]: (Promise<GraphNode[]> | GraphNode[])[] } = {};

  add( node: GraphNode ) {
    if ( !this.shouldAdd( node ) ) {
      return;
    }

    this.nodes.push( node );
    this.addToTaskQueue( node );
    this.addToGraphGroup( node );

    this.report( 'Scheduled node', { ...node.lightExport(), __scheduled: Date.now() } );
  }

  process() {
    for ( const taskQueue of this.nodesQueuedByTask ) {
      const front = taskQueue[ 0 ];

      while ( front.length ) {
        const node = front.shift() as GraphNode;
        this.addToResultGraphGroup( node.graphId, this.processNode( node ) );
      }
    }

    // Remove empty task queues
    for ( let i = this.nodesQueuedByTask.length - 1; i >= 0; i-- ) {
      const taskQueue = this.nodesQueuedByTask[ i ];
      const back = taskQueue[ 1 ];
      if ( back.length === 0 ) {
        this.nodesQueuedByTask.splice( i, 1 );
      }
    }

    const result: (Promise<GraphNode[]> | GraphNode[])[][] = [];

    for ( const graphId of Object.keys( this.nodeResultsGroupedByGraph ) ) {
      const group = this.nodeResultsGroupedByGraph[ graphId ];
      if ( group.length === this.nodesGroupedByGraph[ graphId ].length ) {
        result.push( this.nodeResultsGroupedByGraph[ graphId ] );
        delete this.nodeResultsGroupedByGraph[ graphId ];
        delete this.nodesGroupedByGraph[ graphId ];
      }
    }

    return result;
  }

  isProcessed() {
    return false;
  }

  addToTaskQueue( node: GraphNode ) {
    const taskQueue = this.nodesQueuedByTask.find(
      taskQueue =>
        ( taskQueue[ 0 ].length && taskQueue[ 0 ][ 0 ].sharesTaskWith( node ) ) ||
        ( taskQueue[ 1 ].length && taskQueue[ 1 ][ 0 ].sharesTaskWith( node ) ),
    );

    if ( taskQueue ) {
      const front = taskQueue[ 0 ];
      const back = taskQueue[ 1 ];

      if ( front.length ) {
        if ( node.getConcurrency() === 0 ) {
          front.push( node );

        } else {
          if ( front.length < node.getConcurrency() && back.length === 0 ) {
            front.push( node );
          } else {
            back.push( node );
          }
        }

      } else if ( back.length ) {
        back.push( node );
      }

    } else {
      this.nodesQueuedByTask.push( [ [ node ], [] ] );
    }
  }

  shiftTaskQueue( node: GraphNode ) {
    const taskQueue = this.nodesQueuedByTask.find(
      taskQueue =>
        ( taskQueue[ 0 ].length && taskQueue[ 0 ][ 0 ].sharesTaskWith( node ) ) ||
        ( taskQueue[ 1 ].length && taskQueue[ 1 ][ 0 ].sharesTaskWith( node ) ),
    );

    if ( taskQueue ) {
      const front = taskQueue[ 0 ];
      const back = taskQueue[ 1 ];

      if ( back.length ) {
        if ( node.getConcurrency() === 0 ) {
          while ( back.length ) {
            const node = back.shift() as GraphNode;
            front.push( node );
          }
        } else if ( front.length < node.getConcurrency() ) {
          const node = back.shift() as GraphNode;
          front.push( node );
        }
      }
    }
  }

  addToGraphGroup( node: GraphNode ) {
    if ( this.nodesGroupedByGraph[ node.graphId ] ) {
      this.nodesGroupedByGraph[ node.graphId ].push( node );
    } else {
      this.nodesGroupedByGraph[ node.graphId ] = [ node ];
    }
  }


  addToResultGraphGroup( graphId: string, result: Promise<GraphNode[]> | GraphNode[] ) {
    if ( this.nodeResultsGroupedByGraph[ graphId ] ) {
      this.nodeResultsGroupedByGraph[ graphId ].push( result );
    } else {
      this.nodeResultsGroupedByGraph[ graphId ] = [ result ];
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
    this.nodes.splice( this.nodes.indexOf( node ), 1 );
    this.shiftTaskQueue( node );

    if ( node.graphDone() ) {
      GraphRegistry.instance.updateSelf( nodeData );
      this.report( 'Graph completed', nodeData );
    }
  }
}
