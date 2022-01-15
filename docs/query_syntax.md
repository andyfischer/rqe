
# Query Syntax

This library has its own query syntax for fetching and transforming data.

Note that we're planning to also support SQL sometime in the future.

The syntax was inspired by various data transformation syntaxes out there,
including the one used by [Sumo Logic](https://help.sumologic.com/01Start-Here/Quick-Start-Tutorials).

We looked at the best syntaxes out there for relational engines like SQL, but found SQL
to be overly verbose, and hard to compose / chain. So here's what we came up with.

Compared to SQL, the builtin syntax:

 - Does not use the FROM keyword at all. The appropriate table is found just based on
   which attributes (aka columns) are mentioned.
 - Chains together steps with the pipe operator `|` for operations like sorting, limiting, 
   additional filtering, etc.

### Example queries ###

Fetch all the items from the table with attributes `user` and `name`:

    `user name`

Fetch the name associated with a certain user:

    `user=xyz name`

Fetch up to 10 users:

    `user name | limit 10`

### Syntax ###

    <get parameters> (| <verb> <parameters>)

Each query starts with a list of parameters (the "get" operation).

The parameters contains either empty attributes (like `user`), or attribute-value tags (like `user=xyz`).

After the first operation you can optionally add transform steps, each one with a verb and its own parameters.

| Verb | Description |
| ----  | ----------- |
| count | Outputs a single count=`x` item with the count of incoming items. |
| join <query> | Interprets the parameters as another table fetch, and joins the results with the incoming items. |
| just <attributes> | Transforms values to only include the given <attributes> |
| last <n>          | Outputs the final N items. |
| limit <n>         | Outputs the first N items. |
| one               | Outputs a single item.     |
| rename <x> -> <y>     | Transforms incoming values so that attribute <y>x is renamed to <y> |
| reverse           | Collects all the incoming items and then outputs them in reverse order |
| value <item>      | Sends the <item> parameter as an output value |
| where <condition> | Filters the outputs to only include items matching the condition |
| without <attributes> | Transforms values to not include the given <attributes> |
