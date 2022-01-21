
### Verbs ###

Each verb will pipe an input stream from an output stream.

Verbs with type "stream" will send outputs as soon as inputs are received. Verbs with type "aggregate" wait
until the input stream is completely done before sending any outputs.

| Verb | Type | Description |
| ---- | -----| ----------- |
| count | aggregate | Outputs a single `count=x` item with the count of incoming items. |
| join `<query>` | stream | Interprets the parameters as another table fetch, and joins the results with the incoming items. |
| just `<attributes>` | stream | Transforms values to only include the given <attributes> |
| last `<n>`          | aggregate | Outputs the final N items. |
| limit `<n>`         | stream | Outputs the first N items. |
| one               | stream | Outputs a single item.     |
| rename `<x> -> <y>`     | stream | Transforms incoming values so that attribute `<x>` is renamed to `<y>` |
| reverse           | aggregate | Collects all the incoming items and then outputs them in reverse order. |
| to_csv           | aggregate | Collect items and format them into a CSV. Outputs a single `{ buffer:Buffer }` item |
| value `<item>`      | stream | Sends the <item> parameter as an output value. |
| where `<condition>` | stream | Filters the outputs to only include items matching the condition. |
| without `<attributes>` | aggregate | Transforms values to not include the given `<attributes>`. |

