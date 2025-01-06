import GraphNode from '../graph/GraphNode';
import Task from '../graph/Task';
import GraphLayer from './GraphLayer';


export default abstract class GraphVisitor {
  abstract visitLayer( layer: GraphLayer ): any;
  abstract visitNode( node: GraphNode ): any;
  abstract visitTask( task: Task ): any;
}
