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
  //   PORT: '3000',
  //   URL: 'localhost',
  // } ) ) {
  //   return;
  // }

  const task1 = ProcessingGraph.createTask( asyncTaskFunction, 'Task 1' );
  const task2 = ProcessingGraph.createTask( splitTaskFunction, 'Task 2' );
  const task3 = ProcessingGraph.createTask( syncTaskFunction, 'Task 3' );
  const task4 = ProcessingGraph.createTask( asyncTaskFunction, 'Task 4' );
  const task5 = ProcessingGraph.createDeputyTask( 'Routine 5', 'Service 3' );
  const task6 = ProcessingGraph.createUniqueTask( joinFunction, 'Task 6' );
  const task7 = ProcessingGraph.createTask( syncTaskFunction, 'Task 7' );
  const task8 = ProcessingGraph.createTask( syncTaskFunction, 'Task 8' );
  const task9 = ProcessingGraph.createTask( syncTaskFunction, 'Task 9' );
  const task10 = ProcessingGraph.createTask( asyncTaskFunction, 'Task 10' );
  const task11 = ProcessingGraph.createTask( asyncTaskFunction, 'Task 11' );

  task2.doAfter( task1 );
  task3.doAfter( task2 );
  task4.doAfter( task2 );
  task5.doAfter( task3 );
  task6.doAfter( task5 );
  task7.doAfter( task4 );
  task8.doAfter( task4 );
  task9.doAfter( task6 );
  task10.doAfter( task6 );
  task11.doAfter( task8 );


  ProcessingGraph.createRoutine( 'Routine 1', [ task1 as Task ], 'Test routine description' );
  ProcessingGraph.createRoutine( 'Routine 2', [ task4 ] );

  const server = ProcessingGraph.createServer( 'Service 1', 'Service 1 description', { useSocket: true, loadBalance: true } );
  server.start();
}

main();
