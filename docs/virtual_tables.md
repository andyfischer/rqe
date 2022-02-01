
# Declaring virtual tables

Following the philosophy of "treat everything like a database", this library supports adding virtual tables-
where a query can be resolved using your own custom function (instead of a Table).

### Quick example

The easiest way is with [`Graph.func`](./rqe.graph.func.md):

    import { Graph } from 'rqe';
    
    let graph = new Graph();

    graph.func('a -> a_squared', ({ a }) => {
        return { a_squared: a * a };
    });

With that declared, this function can now be triggered by queries (see [making queries](./making_queries.md) for more context):

    let result = graph.query("a=2 a_squared").sync().one();

    console.log(result); // prints: { a: 2, a_squared: 4 }

### .func API

##### `Graph.func(decl: string, callback: ItemCallback)`

#### 'decl' string

The decl has format:

    <input attributes>* -> <output attributes>

Example:

    a -> a_squared

In this example, the function has one input (`a`) and one output (`a_squared`).

When resolving a query that might use this function, here are the rules:

 - The "inputs" are all required. The query must contain all of these in order for this function to be used.
 - The "outputs" are optional - the query may or may not include some or all of these.
 - If the query asks for anything not included in the inputs or outputs, the function is not used.

### ItemCallback

The callback (the 2nd arg to declaring a func) has the following signature:

    type ItemCallback = (item: Item) => Output
    type Output = Item | Item[] | Promise<Item> | Promise<Item[]>

#### Input

The function takes the query's values as an object. If an attribute has no value, then the `item` object uses
`null` for that field.

In the above example with the query `a=2 a_squared`: the callback will be called with an input of `{a: 2, a_squared: null}`.

#### Output

The callback can return a few different things..

 - A single object (such as the above example returning `{a_squared: ...}`.
 - An array of objects. In this case the query will output multiple results.
 - Or, a Promise containing either of the above. In this case the query will finish asynchronously.

