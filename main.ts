import ProcessingGraph from './src/index';
import { sleep } from './src/utils/promise';



async function main() {

  const agent1 = ProcessingGraph.createAgent( 'Agent 1', 'Some description', { useSocket: true, loadBalance: true } );
  const agent2 = ProcessingGraph.createAgent( 'Agent 2', 'Another description', { useSocket: true, loadBalance: true } );

  await sleep( 3000 );
  const promise1 = agent1.createContract( 'Routine 4', { ms: 1000, foo: 4, count: 0 } );
  await sleep( 1000 );
  const promise2 = agent1.createContract( 'Routine 1', { ms: 700, foo: 1, count: 0 } );
  const promise3 = agent1.createContract( 'Routine 3', { ms: 1200, foo: 3, count: 0 } );
  await sleep( 100 );
  const promise4 = agent1.createContract( 'Routine 2', { ms: 800, foo: 2, count: 0 } );
  await sleep( 2000 );
  const promise5 = agent2.createContract( 'Service 1:Task 7', { ms: 500, foo: 5, count: 0 } );
  await sleep( 1000 );
  const promise6 = agent1.createContract( 'Service 2:Task 7', { ms: 2000, foo: 6, count: 0 } );

  console.log( await promise1);
  console.log( await promise2);
  console.log( await promise3);
  console.log( await promise4);
  console.log( await promise5);
  console.log( await promise6);
}

main();
