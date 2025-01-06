import GraphNode from '../graph/GraphNode';
import GraphBuilder from './GraphBuilder';
import GraphRun from '../runners/GraphRun';


export default abstract class GraphRunState {
  protected graphBuilder: GraphBuilder;
  protected context?: GraphRun;

  constructor( builder: GraphBuilder ) {
    this.graphBuilder = builder;
  }

  setContext( run: GraphRun ) {
    this.context = run;
  }

  changeStrategy( builder: GraphBuilder ) {
    this.graphBuilder = builder;
  }

  protected reset() {
    this.graphBuilder.reset();
  }

  addNode( node: GraphNode ) {
    this.graphBuilder.addNode( node );
  }

  updateContext() {
    this.context?.setGraph( this.graphBuilder.getResult() );
  }

  abstract run(): void;
  abstract export(): any;
}
