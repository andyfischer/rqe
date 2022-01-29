
# Creating Tables #

A Table is an in-memory list of items, possibly with some lookup indexes attached.

### Terminology

A Table contains *items* (aka "rows"). Each item has *attributes* (aka "columns"). Items are stored
as plain Javascript objects.

When creating a new table, you can either create one as part of a [Graph]('./rqe.graph.md'), 
or a standalone table. Adding it to a Graph helps if you're planning to make queries that can
potentially query multiple tables.

Creating a table on a Graph:

    const table = graph.newTable({ ... config ... })

Creating a standalone table:

    import { Table } from 'rqe'
    const table = new Table({ ... config ... });

### Constructor config ###

| field | required? | description |
| ----- | --------- | ----------- |
| attrs | yes       | List of attributes in this table (see below) |
| funcs | no        | Summary of the ways that the table will be accessed (see below) |

### Declaring attrs ###

The attributes list is a space-seperated list of the fields stored in this table.

    const table = new Table({
        attrs: 'user_id name'
    });

    table.put({ user_id: 'xyz', name: 'The Name'});

The `attrs` list is not strictly enforced (you can add extra fields on your items that aren't
mentioned in `attrs`), but if you're going to query by a certain field then it needs to be
listed in `attrs`

### Declaring funcs ###

The `funcs` list is a summary of the ways that the table will be accessed. This tells the Table
what indexes it needs to create.

Each `func` has the syntax of:

    `<required input attributes> -> <optional output attributes>`

As an example, if the func is: `a b -> c d`, this means that the table can be searched using both attributes
`a` and `b`. The table will maintain a lookup index using those values.

On the right hand side of the `->` is the list of outputs. In this context you can skip
writing anything after the `->` if you want, since all of the table's attributes are
available as outputs by default.

Example:

    const table = new Table({
        attrs: 'user_id name',
        funcs: [
            'user_id -> name'
        ]
    });

    // Find the user name using a user_id:
    let { name } = table.where({ user_id: 'xyz' });

    // This will throw an error, because the table has no index using just 'name'.
    // (If you wanted to lookup by name, you can add `name ->` to the funcs).
    let { user_id } =  table.where({ name: 'The Name' });

