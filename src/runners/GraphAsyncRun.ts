import GraphRunState from '../interfaces/GraphRunState';
import GraphNode from '../graph/GraphNode';
import ExecutionChain from '../interfaces/ExecutionChain';


export default class GraphAsyncRun extends GraphRunState {
  private initiated = false;

  async run() {
    await this.graphBuilder.compose();
    this.updateContext();
    this.reset();
  }

  addNode( node: GraphNode ) {
    super.addNode( node );

    if ( !this.initiated ) {
      this.context?.report( 'Scheduled node', { ...node.lightExport() } );
      this.context?.setNext( this.graphBuilder.getResult() as unknown as ExecutionChain );
      this.initiated = true;
    }
  }

  protected reset() {
    this.initiated = false;
    super.reset();
  }

  export(): any {
    return {};
  }
}
