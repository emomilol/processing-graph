import GraphVisitor from '../interfaces/GraphVisitor';
import SyncGraphLayer from '../graph/SyncGraphLayer';
import GraphNode from '../graph/GraphNode';
import Task from '../graph/Task';
import ColorRandomizer from '../utils/ColorRandomizer';


export default class VueFlowExportVisitor implements GraphVisitor {
  private nodeCount = 0;
  private elements: any[] = [];
  private index = 0;
  private contextToColor: { [ id: string ]: string } = {};
  private colorRandomizer = new ColorRandomizer();

  visitLayer( layer: SyncGraphLayer ): any {
    const snapshot = layer.export();

    this.elements.push( {
      id: String( snapshot.__index ),
      label: `Layer ${ snapshot.__index }`,
      position: { x: snapshot.__index * 500, y: -50 * snapshot.__numberOfNodes * 0.5 },
      connectable: false,
      draggable: true,
      style: { backgroundColor: 'rgba(16, 185, 129, 0.5)', width: '200px', height: `${ 60 * snapshot.__numberOfNodes + 50 }px` },
      data: {
        numberOfNodes: snapshot.__numberOfNodes,
        executionTime: snapshot.__executionTime,
      },
    } );

    this.index = 0;
  }

  visitNode( node: GraphNode ): any {
    const snapshot = node.export();

    if ( !this.contextToColor[ snapshot.__context.__id ] ) {
      this.contextToColor[ snapshot.__context.__id ] = this.colorRandomizer.getRandomColor();
    }

    const color = this.contextToColor[ snapshot.__context.__id ];

    this.elements.push( {
      id: snapshot.__id.slice( 0, 8 ),
      label: snapshot.__task.__name,
      position: { x: 10, y: this.index * 60 + 30 },
      parentNode: String( snapshot.__task.__layerIndex ),
      sourcePosition: 'right',
      targetPosition: 'left',
      style: { backgroundColor: `${ color }`, width: '180px' },
      data: {
        executionTime: snapshot.__executionTime,
        description: snapshot.__task.__description,
        functionString: snapshot.__task.__functionString,
      },
    } );

    for ( const [ index, nextNodeId ] of snapshot.__nextNodes.entries() ) {
      this.elements.push( {
        id: `${ snapshot.__id.slice( 0, 8 ) }-${ index }`,
        source: snapshot.__id.slice( 0, 8 ),
        target: nextNodeId.slice( 0, 8 ),
      } );
    }

    this.index++;
    this.nodeCount++;
  }

  visitTask( task: Task ) {
    const snapshot = task.export();

    this.elements.push( {
      id: snapshot.__id.slice( 0, 8 ),
      label: snapshot.__name,
      position: { x: snapshot.__layerIndex * 300, y: this.index * 50 + 30 },
      sourcePosition: 'right',
      targetPosition: 'left',
      data: {
        description: snapshot.__description,
        functionString: snapshot.__functionString,
        layerIndex: snapshot.__layerIndex,
      },
    } );

    for ( const [ index, nextTaskId ] of snapshot.__nextTasks.entries() ) {
      this.elements.push( {
        id: `${ snapshot.__id.slice( 0, 8 ) }-${ index }`,
        source: snapshot.__id.slice( 0, 8 ),
        target: nextTaskId.slice( 0, 8 ),
      } );
    }

    this.index++;
    this.nodeCount++;
  }

  getElements() {
    return this.elements;
  }

  getNodeCount() {
    return this.nodeCount;
  }
}
