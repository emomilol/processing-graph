import { v4 as uuid } from 'uuid';
import GraphContext from '../context/GraphContext';
import GraphVisitor from '../interfaces/GraphVisitor';
import TaskIterator from '../iterators/TaskIterator';
import Graph from '../interfaces/Graph';
import GraphRegistry from '../server/GraphRegistry';

export type TaskFunction = ( context: any ) => TaskResult;
export type TaskResult = boolean | string | object | Generator | Promise<any>;

export interface TaskType {
  id: string;
  name: string;
  description: string;
  doAfter: ( ...tasks: ProcessingTask[] ) => void;
  doOnFail: ( ...tasks: Task[] ) => void;
  process: ( context: GraphContext ) => TaskResult;
  export: () => ProcessingTaskSnapshot;
}

export interface ProcessingTask extends TaskType {
  layerIndex: number;
  destroy: () => void;
}

export interface ProcessingTaskSnapshot {
  __id: string;
  __name: string;
  __description: string;
  __layerIndex: number;
  __isUnique: boolean;
  __concurrency: number;
  __functionString: string;
  __nextTasks: string[];
  __previousTasks: string[];
  __onFailTasks: string[];
}

export default class Task implements ProcessingTask, Graph {
  id: string;
  readonly name: string;
  readonly description: string;
  readonly concurrency: number;
  readonly isUnique: boolean = false;

  layerIndex: number = 0;
  private nextTasks: Task[] = [];
  private onFailTasks: Task[] = [];
  private predecessorTasks: Task[] = [];

  protected readonly taskFunction: TaskFunction;

  constructor(
    task: TaskFunction,
    name: string,
    description: string = '',
    unique: boolean = false,
    concurrency: number = 0,
  ) {
    this.id = uuid();
    this.taskFunction = task;
    this.name = name;
    this.description = description;
    this.isUnique = unique;
    this.concurrency = concurrency;
  }

  public setGlobalId( id: string ) {
    this.id = id;
  }

  public process( context: GraphContext ) {
    if ( this.taskFunction ) {
      return this.taskFunction( context.getContext() );
    }

    return false;
  }

  public doAfter( ...tasks: ProcessingTask[] ) {
    for ( const predecessorTask of tasks as Task[] ) {
      if ( predecessorTask.layerIndex >= this.layerIndex ) {
        this.layerIndex = predecessorTask.layerIndex + 1;
      }

      predecessorTask.nextTasks.push( this );
      this.predecessorTasks.push( predecessorTask );
    }

    for ( const nextTask of this.nextTasks ) {
      nextTask.updateLevelFromPredecessor( this.layerIndex );
    }
  }

  public doOnFail( ...tasks: Task[] ) {
    for ( const task of tasks ) {
      if ( task.layerIndex <= this.layerIndex ) {
        task.layerIndex = this.layerIndex + 1;
      }

      task.predecessorTasks.push( this );
      for ( const nextTask of task.nextTasks ) {
        nextTask.updateLevelFromPredecessor( task.layerIndex );
      }

      this.onFailTasks.push( task );
    }
  }

  private updateLevelFromPredecessor( predecessorLevel: number ) {
    this.layerIndex = Math.max( this.layerIndex, predecessorLevel + 1 );

    for ( const nextStep of this.nextTasks ) {
      nextStep.updateLevelFromPredecessor( this.layerIndex );
    }
  }

  // Helper function
  public mapNext( callback: ( task: Task ) => any, failed: boolean = false ): any[] {
    return failed ? this.onFailTasks.map( callback ) : this.nextTasks.map( callback );
  }

  public destroy() {
    for ( const predecessorTask of this.predecessorTasks ) {
      predecessorTask.nextTasks.splice( predecessorTask.nextTasks.indexOf( this ), 1 );
    }

    for ( const nextTask of this.nextTasks ) {
      nextTask.predecessorTasks.splice( nextTask.predecessorTasks.indexOf( this ), 1 );
    }

    this.nextTasks = [];
    this.predecessorTasks = [];

    GraphRegistry.instance.deleteTask( this );
  }

  public decouple( task: Task ) {
    task.nextTasks.splice( task.nextTasks.indexOf( this ), 1 );
  }

  public export(): ProcessingTaskSnapshot {
    return {
      __id: this.id,
      __name: this.name,
      __description: this.description,
      __layerIndex: this.layerIndex,
      __isUnique: this.isUnique,
      __concurrency: this.concurrency,
      __functionString: this.taskFunction.toString(),
      __nextTasks: this.nextTasks.map( t => t.id ),
      __onFailTasks: this.onFailTasks.map( t => t.id ),
      __previousTasks: this.predecessorTasks.map( t => t.id ),
    };
  }

  public getIterator() {
    return new TaskIterator( this );
  }

  public accept( visitor: GraphVisitor ) {
    visitor.visitTask( this );
  }

  public log() {
    console.log( this.name );
  }
}
