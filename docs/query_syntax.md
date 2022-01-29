
# Query Syntax

This library has its own query syntax for fetching and transforming data.

We looked at the best syntaxes out there for relational engines, including SQL, but found SQL
to be overly verbose, and hard to compose and build. (see ["against SQL"](https://www.scattered-thoughts.net/writing/against-sql/))

Looking at modern systems that have the most user-friendly queries for fetching data,
(specifically looking at Splunk, Sumologic, and Datadog), there are a few common trends that
we copied in the syntax for RQE:

 - Multistep queries are built using a left-to-right Unix-style piping syntax (`|`), instead of SQL's CTEs.
 - Don't need to specify the name of the table (no FROM keyword)

Note that we might add support for SQL syntax in the future since many people love it.

### Example queries ###

Fetch all the items from the table with attributes `user_id` and `name`:

    user_id name

Fetch the name associated with a certain user_id:

    user_id=xyz name

Fetch up to 10 users by adding `| limit 10` to the above.

    user_id name | limit 10

### Some examples compared with SQL ###

| description | RQE | SQL |
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
