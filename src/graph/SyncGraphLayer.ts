import GraphNode from './GraphNode';
import GraphLayer from '../interfaces/GraphLayer';


export default class SyncGraphLayer extends GraphLayer {

  process(): GraphNode[] {
    this.start();

    const result: GraphNode[] = [];
    for ( const node of this.nodes ) {
      if ( node.isProcessed() ) {
        continue;
      }

      const newNodes = node.process();

      if ( newNodes instanceof Promise ) {
        throw 'Asynchronous functions are not allowed in sync mode!';
      }

      result.push( ...newNodes as GraphNode[] );
    }

    this.end();

    return result;
  }
}
