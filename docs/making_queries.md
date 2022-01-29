
# Making queries #

To start making tables, you'll either need a [Graph]('./rqe.graph.md') or
a [Table]('./rqe.graph.md') instance.

The call is:

    Graph.query(queryString: string): Stream

or 

    Table.query(queryString: string): Stream

### Example ###

    import { Graph } from 'rqe'

    const graph = new Graph();
    // ... set up tables ...

    const result = graph.query('user name');

### Using results: ###

The result is a [Stream](./rqe.stream.md) instance. There are a few ways
to use the data from a Stream:

#### Asynchronously get a Table ####

Streams implement the Promise API, so they can be resolved as a promise. The result
is a [Table](./rqe.table.md) instance.

    const table: Table = await graph.query('user name');

#### Get a table as an asynchronous callback ####

    graph.query('user name').callback((table: Table) => {
        // ...
    });
    
#### Stream results with an async iterator ####

The Stream object implements the ES2018 async iterator protocol, so with a `for await` block,
you can process results as soon as they are ready.

Example:

    for await (const item of graph.query('user name')) {
        ...
    }

#### Synchronously get a Table ####

If you're sure that your query will be resolved synchronously, then you can use the `.sync()`
API to immediately get the results. If the query doesn't finish synchronously then this will
throw an exception. Internally we just use this style in unit tests. It's dangerous to use
it for arbitrary queries.

    const table = graph.query('user name').sync();

### Using a Table result ###

Some operations return a [Table](./rqe.table.md) instance which is basically an
in-memory list of items.

A quick guide to using items from the Table:

Convert to an Array using `.list()`:

    const table = await graph.query('user name');
    const items = table.list();

Using the ES6 Iterator protocol:

    const table = await graph.query('user name');
    for (const item of table) {
        ...
    }
