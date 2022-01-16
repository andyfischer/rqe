
# Query Syntax

This library has its own query syntax for fetching and transforming data.

The syntax was inspired by various data transformation syntaxes out there,
including the one used by [Sumo Logic](https://help.sumologic.com/01Start-Here/Quick-Start-Tutorials).

We looked at the best syntaxes out there for relational engines like SQL, but found SQL
to be overly verbose, and hard to compose / chain. So here's what we came up with.

Compared to SQL, the builtin syntax:

 - Does not use the FROM keyword at all. The appropriate table is found just based on
   which attributes (aka columns) are mentioned.
 - Chains together steps with the pipe operator `|` for operations like sorting, limiting, 
   additional filtering, etc.

Note that we ARE planning to also support for SQL syntax at some point.

### Example queries ###

Fetch all the items from the table with attributes `user_id` and `name`:

    user_id name

Fetch the name associated with a certain user_id:

    user_id=xyz name

Fetch up to 10 users:

    user_id name | limit 10

### Compared with SQL ###

Fetch items from a table.

| description | tiny-memory-db | SQL |
| ----------- | -------------- | --- | 
| Fetch items from a table | `user_id name` | `SELECT user_id, name from user` |
| Limit results | `user_id name \| limit 10` | `SELECT user_id, name from user LIMIT 10` |
| Filter by a column value | `user_id=xyz name` | `SELECT user_id, name from user WHERE user_id="xyz"` |
| Join | `user_id name \| join user_id is_subscribed` | `SELECT user.user_id, user.name, subscription_status.is_subscribed FROM user INNER JOIN subscription_status ON subscription_status.user_id = user.user_id` |

### Syntax ###

    <get parameters> (| <verb> <parameters>)*

Each query starts with a list of parameters (the "get" operation), followed optionally by a list of piped transformation steps.

In the "get", the parameters can either be empty attributes (like `user`), or attribute-value tags (like `user=xyz`). The
table is found implicitly based on which attributes are used.

See: [Verbs](./verbs.md)
