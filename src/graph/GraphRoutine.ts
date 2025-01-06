import { v4 as uuid } from 'uuid';
import { ProcessingTask } from './Task';


export default class GraphRoutine {
  id: string;
  readonly name: string;
  readonly description: string;
  private readonly tasks: ProcessingTask[];

  constructor( name: string, description: string, tasks: ProcessingTask[] ) {
    this.id = uuid();
    this.name = name;
    this.description = description;
    this.tasks = tasks;
  }

  forEachTask( callBack: ( task: ProcessingTask ) => void | Promise<void> ) {
    for ( const task of this.tasks ) {
      callBack( task );
    }
  }

  setGlobalId( id: string ) {
    this.id = id;
  }
}
