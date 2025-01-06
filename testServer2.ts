import ProcessingGraph from './src/ProcessingGraph';
import Task from './src/graph/Task';
import { AnyObject } from './types/global';


async function asyncTaskFunction( context: AnyObject ) {
  await new Promise( resolve => setTimeout( resolve, context.ms ) );
  context.count += 1;
  return context;
}

function syncTaskFunction( context: AnyObject ) {
  const list = [];
  for ( let i = 1; i < 10000; i++ ) {
    list.push( i ** 2 / 5 );
  }

  context.count += 1;

  return context;
}

function* splitTaskFunction( context: AnyObject ) {
  const num = Math.floor( Math.random() * 10 );
  for ( let i = 0; i < num; i++ ) {
    yield { ...context, index: i };
  }
}

async function joinFunction( context: AnyObject[] ) {
  await new Promise( resolve => setTimeout( resolve, 1000 ) );
  const newContext = { ...context[ 0 ] };
  let count = 1;
  for ( const ctx of context ) {
    count += ctx.count;
  }

  newContext.count = count;

  return newContext;
}

async function main() {
  // if ( ProcessingGraph.createCluster( {
  //   PORT: '3001',
  //   URL: 'localhost',
  // } ) ) {
  //   return;
  // }

  const task1 = ProcessingGraph.createTask( asyncTaskFunction, 'Task 1' );
  const task2 = ProcessingGraph.createTask( syncTaskFunction, 'Task 2' );
  const task3 = ProcessingGraph.createTask( splitTaskFunction, 'Task 3' );
  const task4 = ProcessingGraph.createTask( syncTaskFunction, 'Task 4' );
  const task5 = ProcessingGraph.createTask( asyncTaskFunction, 'Task 5' );
  const task6 = ProcessingGraph.createUniqueTask( joinFunction, 'Task 6' );
  const task7 = ProcessingGraph.createTask( asyncTaskFunction, 'Task 7' );
  const task8 = ProcessingGraph.createTask( syncTaskFunction, 'Task 8' );

  task2.doAfter( task1 );
  task3.doAfter( task1 );
  task4.doAfter( task2 );
  task5.doAfter( task3 );
  task6.doAfter( task5 );
  task7.doAfter( task4 );
  task8.doAfter( task6 );

  ProcessingGraph.createRoutine( 'Routine 3', [ task1 as Task ], 'Test routine description' );
  ProcessingGraph.createRoutine( 'Routine 4', [ task4 ] );

  const server = ProcessingGraph.createServer( 'Service 2', 'Service 2 description', { useSocket: true, loadBalance: true } );
  server.setPort( 3001 );

  server.start();
}

main();
