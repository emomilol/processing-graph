# processing-graph

To test and generate a database follow these steps...

Open a terminal for each of the following commands in the same order
> npx ts-node testServer1.ts
> npx ts-node testServer2.ts
> npx ts-node testServer3.ts
> npx ts-node testServer4.ts
> npx ts-node testServer5.ts
> npx ts-node main.ts

You can then rerun the main.ts script several times to generate more data

If you want to dump the database and generate new data go to the 
src/server/db/schema.sql and uncomment the first lines of code to drop all tables.
then stop all servers and rerun the > npx ts-node testServer1.ts command. 
Then comment them out and run the other servers again.