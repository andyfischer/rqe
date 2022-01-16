
# tiny-memory-db #

Zero-dependency library for doing database operations on in-memory data.

# Documentation #

See: https://andyfischer.github.io/tiny-memory-db

# Quick Example #

Create a table:

    import { Table } from 'tiny-memory-db';

    ...

    const table = new Table({
        attrs: 'id data time',
        funcs: ['id ->']
    });

This creates a table with three attributes (like columns): 'id', 'data', 'time'.

Add data to the table:

    table.put({ id: 1, data: { ... }, time: Date.now() });

Query the table:

    const results = await table.query('id=1 data time');

Use the results:

    for (const { id, data, time } of results.scan()) {
        ...
    }
