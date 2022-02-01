
# RQE - Relational Query Engine #

Zero-dependency Javascript library for doing database stuff with in-memory functions and data

Inspired by relational algebra theory, but the query syntax is not SQL.

# Documentation #

See: https://andyfischer.github.io/rqe

# Quick Example #

Create a table:

    import { Table } from 'rqe';

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
