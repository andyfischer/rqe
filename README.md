
# tiny-memory-db #

Zero-dependency library for doing database operations on in-memory data.

# Quick Example #

Create a table:

    import { Table } from 'tiny-memory-db';

    ...

    const table = new Table({
        attrs: 'id data time',
        funcs: ['id ->']
    });

This creates a table with three attributes (like columns): 'id', 'data', 'time'.

The `funcs` section describes how the data will be accessed, so this creates a single
index on the `id` attribute.

Add data to the table:

    table.put({ id: 1, data: {}, time: Date.now() });

Query the table:

    await table.query('id=1 data time');

