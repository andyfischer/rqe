
# tiny-memory-db #

Zero-dependency library for doing database-like operations on in-memory data.

# Example #

Everything starts with a Graph instance.

    import { newGraph } from 'tiny-memory-db';

    ...

    const graph = newGraph();

With a graph you can create new tables.

This will create a table with two attributes: 'a' and 'b' (think of an attribute as a "column"):

    const table = graph.newTable({
        attrs: {
            a: {},
            b: {},
        },
        funcs: [
            "a -> b"
        ]
    });

The "funcs" is a list of all the ways that the table will be accessed. The declaration of
`"a -> b"` means that we will be accessing the table using `a` as an input and `b` as an
output. This will tell the table to create an index for `a` values.

Then the table can be accessed directly.

This `.where` call will return all the items where attribute `a` equals `"x"`.

    const items = table.where({ a: "x" });

# Graph queries #

Once the table is set up, you can also run query strings on the whole graph.

This example query will have the same effect:

    const result = graph.query("a=x b");

The query language doesn't use FROM, instead it automatically finds the right table
based on which attributes you use (here: a and b). Passing `a=x` means searching for items
where attribute `a` equals `"x"`.

The response is a Stream object which can be used in a few ways.

It supports the Iterator interface:

    for (const item of graph.query("a=x b")) {
        ...
    }

And can also be turned into a flat array:

    const items = graph.query("a=x b").sync().list();

# Notes #

More documentation in progress..
