import GraphVisitor from './GraphVisitor';
import GraphContext from '../context/GraphContext';
import Iterator from './Iterator';


export default abstract class Graph {
  abstract process( context?: GraphContext ): unknown;
  abstract log(): void;
  abstract destroy(): void;
  abstract export(): any;
  abstract accept( visitor: GraphVisitor ): void;
  abstract getIterator(): Iterator;
}
