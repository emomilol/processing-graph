import SyncGraphLayer from '../graph/SyncGraphLayer';
import Task from '../graph/Task';


export default abstract class GraphExporter {
  abstract exportGraph( graph: SyncGraphLayer ): any;
  abstract exportStaticGraph( graph: Task[] ): any;
}
