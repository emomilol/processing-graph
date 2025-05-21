import ProcessingGraph from './src/graph/ProcessingGraph';
import Task from './src/graph/Task';
import { AnyObject } from './src/types/global';


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

// function failTaskFunction( context: AnyObject ) {
//   context.count += 1;
//   if ( Math.floor( Math.random() * 10 ) === 7 ) {
//     throw `An error has occurred: foo ${ context.foo }`;
//   }
//
//   if ( Math.floor( Math.random() * 10 ) === 6 ) {
//     context.failed = true;
//   }
//
//   return context;
// }

// function* splitTaskFunction( context: AnyObject ) {
//   const num = Math.floor( Math.random() * 10 );
//   for ( let i = 0; i < num; i++ ) {
//     yield { ...context, index: i };
//   }
// }
//
// function joinFunction( context: AnyObject ) {
//   const newContext = { ...context.joinedContexts[ 0 ] };
//   let count = 1;
//   for ( const ctx of context.joinedContexts ) {
//     count += ctx.count;
//   }
//
//   newContext.count = count;
//
//   return newContext;
// }

async function main() {
  // if ( ProcessingGraph.createCluster( {
  //   PORT: '3002',
  //   URL: 'localhost',
  // } ) ) {
  //   return;
  // }

  const task1 = ProcessingGraph.createTask( asyncTaskFunction, 'Task 1', 'This is task 1', 1 );
  const task2 = ProcessingGraph.createTask( asyncTaskFunction, 'Task 2', 'This is task 2', 2 );
  const task3 = ProcessingGraph.createTask( syncTaskFunction, 'Task 3' );
  const task4 = ProcessingGraph.createTask( asyncTaskFunction, 'Task 4', 'This is task 4', 1 );
  const task5 = ProcessingGraph.createDeputyTask( 'Routine 4', 'Service 2', 1 );
  const task6 = ProcessingGraph.createTask( syncTaskFunction, 'Task 6' );
  const task7 = ProcessingGraph.createTask( asyncTaskFunction, 'Task 7', 'This is task 7', 2 );

  task2.doAfter( task1 );
  task3.doAfter( task2 );
  task4.doAfter( task2 );
  task5.doAfter( task3 );
  task6.doAfter( task5 );
  task7.doAfter( task4 );

  ProcessingGraph.createRoutine( 'Routine 5', [ task1 as Task ], 'Test routine description' );

  const server = ProcessingGraph.createServer( 'Service 3', 'Service 3 description', { useSocket: true, loadBalance: true } );
  server.setPort( 3002 );

  server.start();
}

main();

