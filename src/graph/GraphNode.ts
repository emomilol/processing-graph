import { v4 as uuid } from 'uuid';
import Task from './Task';
import GraphContext from '../context/GraphContext';
import Graph from '../interfaces/Graph';
import GraphVisitor from '../interfaces/GraphVisitor';
import GraphNodeIterator from '../iterators/GraphNodeIterator';
import GraphContextFactory from '../context/GraphContextFactory';


export default class GraphNode implements Graph {
  id: string;
  graphId: string;
  private task: Task;
  private context: GraphContext;
  private divided: boolean = false;
  private splitGroupId: string = '';
  private processing: boolean = false;
  private subgraphComplete: boolean = false;
  private graphComplete: boolean = false;
  private result: unknown;
  private previousNodes: GraphNode[] = [];
  private nextNodes: GraphNode[] = [];
  private executionTime: number = 0;
  private executionStart: number = 0;
  private failed: boolean = false;
  private errored: boolean = false;

  constructor( task: Task, context: GraphContext, graphId: string, prevNodes: GraphNode[] = [] ) {
    this.task = task;
    this.context = context;
    this.previousNodes = prevNodes;
    this.id = uuid();
    this.graphId = graphId;
    this.splitGroupId = graphId;
  }

  public isUnique() {
    return this.task.isUnique;
  }

  public isProcessed() {
    return this.divided;
  }

  public isProcessing() {
    return this.processing;
  }

  public subgraphDone() {
    return this.subgraphComplete;
  }

  public graphDone() {
    return this.graphComplete;
  }

  public isEqualTo( node: GraphNode ) {
    return this.sharesTaskWith( node ) && this.sharesContextWith( node ) && this.isPartOfSameGraph( node );
  }

  public isPartOfSameGraph( node: GraphNode ) {
    return this.graphId === node.graphId;
  }

  public sharesTaskWith( node: GraphNode ) {
    return this.task.id === node.task.id;
  }

  public sharesContextWith( node:  GraphNode ) {
    return this.context.id === node.context.id;
  }

  public getLayerIndex() {
    return this.task.layerIndex;
  }

  public getConcurrency() {
    return this.task.concurrency;
  }

  start() {
    if ( this.executionStart === 0 ) {
      this.executionStart = Date.now();
    }
    return this.executionStart;
  }

  end() {
    if ( this.executionStart === 0 ) {
      return 0;
    }

    this.processing = false;
    const end = Date.now();
    this.executionTime = end - this.executionStart;
    return end;
  }

  public process() {
    if ( !this.divided && !this.processing ) {
      this.start();
      this.processing = true;

      try {
        this.result = this.work();
      } catch ( e: unknown ) {
        this.onError( e );
      }

      if ( this.result instanceof Promise ) {
        return this.processAsync();
      }

      this.postProcess();
    }

    return this.nextNodes;
  }

  private async processAsync() {
    try {
      this.result = await this.result;
    } catch ( e: unknown ) {
      this.onError( e );
    }

    this.postProcess();

    return this.nextNodes;
  }

  private work() {
    return this.task.process( this.context );
  }

  private postProcess() {
    if ( typeof this.result === 'string' ) {
      this.onError( `Returning strings is not allowed. Returned: ${ this.result }` );
    }

    if ( Array.isArray( this.result ) ) {
      this.onError( `Returning arrays is not allowed. Returned: ${ this.result }` );
    }

    this.nextNodes = this.divide();

    if ( this.nextNodes.length === 0 ) {
      this.completeSubgraph();
    }

    this.end();
  }

  private onError( error: unknown ) {
    this.result = {
      ...this.context.getFullContext(),
      __error: `Node error: ${ error }`,
      error: `Node error: ${ error }`,
      returnedValue: this.result,
    };
    this.migrate( this.result );
    this.errored = true;
    console.error( 'Node errored', error, this.export() );
  }

  private divide(): GraphNode[] {
    const newNodes: GraphNode[] = [];

    if ( ( this.result as Generator )?.next && typeof ( this.result as Generator ).next === 'function' ) {

      const generator = this.result as Generator;
      let current = generator.next();
      while ( !current.done && current.value !== undefined ) {
        newNodes.push( ...this.generateNewNodes( current.value ) );
        current = generator.next();
      }

    } else if ( this.result !== undefined && !this.errored ) {
      newNodes.push( ...this.generateNewNodes( this.result ) );
      if ( typeof this.result !== 'boolean' ) {
        this.migrate( { ...this.result, ...this.context.getMetaData() } );
      }

    } else if ( this.errored ) {
      newNodes.push( ...this.task.mapNext(
        ( t: Task ) => this.clone().split( uuid() ).differentiate( t ).migrate( { ...this.result as any } ),
        true,
      ) );
    }

    this.divided = true;
    this.migrate( { ...this.context.getFullContext(), __nextNodes: newNodes.map( n => n.id ) } );

    return newNodes;
  }

  private generateNewNodes( result: any ) {
    const groupId = uuid();
    const newNodes = [];
    if ( typeof result !== 'boolean' ) {
      const failed = ( result.failed !== undefined && result.failed ) || result.error !== undefined;
      newNodes.push(
        ...this.task.mapNext(
          ( t: Task ) => {
            const context = t.isUnique ?
              {
                joinedContexts: [ { ...result, taskName: this.task.name, __nodeId: this.id } ],
                ...this.context.getMetaData(),
              } :
              { ...result, ...this.context.getMetaData() };
            return this.clone().split( groupId ).differentiate( t ).migrate( context );
          },
          failed,
        ) as GraphNode[],
      );

      this.failed = failed;

    } else {
      const shouldContinue = !result;
      if ( shouldContinue ) {
        newNodes.push(
          ...this.task.mapNext(
            ( t: Task ) => {
              const newNode = this.clone().split( groupId ).differentiate( t );
              if ( t.isUnique ) {
                newNode.migrate( {
                  joinedContexts: [ { ...this.context.getContext(), taskName: this.task.name, __nodeId: this.id } ],
                  ...this.context.getMetaData(),
                } );
              }

              return newNode;
            },
          ) as GraphNode[],
        );
      }
    }

    return newNodes;
  }

  private differentiate( task: Task ): GraphNode {
    this.task = task;
    return this;
  }

  private migrate( ctx: any ): GraphNode {
    this.context = GraphContextFactory.instance.getContext( ctx );
    return this;
  }

  private split( id: string ): GraphNode {
    this.splitGroupId = id;
    return this;
  }

  public clone(): GraphNode {
    return new GraphNode( this.task, this.context, this.graphId, [ this ] );
  }

  public consume( node: GraphNode ) {
    this.context = this.context.combine( node.context );
    this.previousNodes = this.previousNodes.concat( node.previousNodes );
    node.completeSubgraph();
    node.changeIdentity( this.id );
    node.destroy();
  }

  private changeIdentity( id: string ) {
    this.id = id;
  }

  private completeSubgraph() {
    for ( const node of this.nextNodes ) {
      if ( !node.subgraphDone() ) {
        return;
      }
    }

    this.subgraphComplete = true;

    if ( this.previousNodes.length === 0 ) {
      this.completeGraph();
      return;
    }

    this.previousNodes.forEach( n => n.completeSubgraph() );
  }

  private completeGraph() {
    this.graphComplete = true;
    this.nextNodes.forEach( n => n.completeGraph() );
  }

  public destroy() {
    // @ts-ignore
    this.context = null;
    // @ts-ignore
    this.task = null;
    this.nextNodes = [];
    this.previousNodes.forEach( n => n.nextNodes.splice( n.nextNodes.indexOf( this ), 1 ) );
    this.previousNodes = [];
    this.result = undefined;
  }

  public getIterator() {
    return new GraphNodeIterator( this );
  }

  public mapNext( callback: ( node: GraphNode ) => any ) {
    return this.nextNodes.map( callback );
  }

  public accept( visitor: GraphVisitor ) {
    visitor.visitNode( this );
  }

  public export() {
    return {
      __id: this.id,
      __task: this.task.export(),
      __context: this.context.export(),
      __result: this.result,
      __executionTime: this.executionTime,
      __executionStart: this.executionStart,
      __nextNodes: this.nextNodes.map( node => node.id ),
      __previousNodes: this.previousNodes.map( node => node.id ),
      __graphId: this.graphId,
      __isProcessing: this.processing,
      __graphComplete: this.graphComplete,
      __failed: this.failed,
      __errored: this.errored,
      __isUnique: this.isUnique(),
      __splitGroupId: this.splitGroupId,
    };
  }

  lightExport() {
    return {
      __id: this.id,
      __task: {
        __id: this.task.id,
        __name: this.task.name,
      },
      __context: this.context.export(),
      __executionTime: this.executionTime,
      __executionStart: this.executionStart,
      __nextNodes: this.nextNodes.map( node => node.id ),
      __previousNodes: this.previousNodes.map( node => node.id ),
      __graphId: this.graphId,
      __isProcessing: this.processing,
      __graphComplete: this.graphComplete,
      __failed: this.failed,
      __errored: this.errored,
      __isUnique: this.isUnique(),
      __splitGroupId: this.splitGroupId,
    };
  }

  public log() {
    console.log( this.task.name, this.context.getContext(), this.executionTime );
  }
}
