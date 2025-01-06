import GraphExporter from '../interfaces/GraphExporter';
import SyncGraphLayer from '../graph/SyncGraphLayer';
import VueFlowExportVisitor from './VueFlowExportVisitor';
import Task from '../graph/Task';


export default class VueFlowExporter implements GraphExporter {
  exportGraph( graph: SyncGraphLayer ): any {
    const exporterVisitor = new VueFlowExportVisitor();
    const layers = graph.getIterator();
    while ( layers.hasNext() ) {
      const layer = layers.next();
      layer.accept( exporterVisitor );
    }

    return {
      elements: exporterVisitor.getElements(),
      numberOfNodes: exporterVisitor.getNodeCount(),
    };
  }

  exportStaticGraph( graph: Task[] ) {
    const exporterVisitor = new VueFlowExportVisitor();

    let prevTask = null;
    for ( const task of graph ) {
      if ( task === prevTask ) {
        continue;
      }

      const tasks = task.getIterator();
      const exportedTaskIds: string[] = [];

      while ( tasks.hasNext() ) {
        const task = tasks.next();
        if ( task && !exportedTaskIds.includes( task.id ) ) {
          exportedTaskIds.push( task.id );
          task.accept( exporterVisitor );
        }

      }

      prevTask = task;
    }

    return {
      elements: exporterVisitor.getElements(),
      numberOfNodes: exporterVisitor.getNodeCount(),
    };
  }
}
