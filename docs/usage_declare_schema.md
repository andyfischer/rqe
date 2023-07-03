
# Usage: Declaring a Schema

A new Schema can be created by calling compileSchema. Each Schema has a name, an optional list of declared attributes, and
a list of supported functions. During the compilation process, the system will pick a good data structure depending
on what functions you want the table to support.

Example:

    const schema = compileSchema({
        name: 'MyData',
        attrs: [
            'a',
            'b',
        ],
        funcs: [
            'get(a)',
            'list(b)',
        ]
    });

# .attrs section

In the `attrs` section you can declare the attributes (fields) that each item in the table should have.

It's not required to declare every possible attribute (an item can be inserted which has attrs that are not declared here).

This section lets you declare special dynamic attributes like `auto`.

## Available attr declarations

As of this version, `auto` is the only option supported.

| Syntax | Description |
| ------ | ----------- |
| `id(auto)`  | Declares the given attribute ("id" in this example) to be an automatically assigned unique ID |

# .funcs section

The `funcs` section declares the functions that will be available on the table at runtime. This
section also has implications for the choice of data structure.

See [Usage: Tables] for more documentation on the related runtime functions.

## Available func declarations

| Syntax | Description |
| ------ | ----------- |
| `get(a)`  | Provides a table function `.get_with_a(value): Item` that returns a single item where `a=value`. Implies (but doesn't require) that `a` is a unique attribute. |
| `list(a)`  | Provides a table function `.list_with_a(value): Array<Item>` that returns an array of items where `a=value`. Implies (but doesn't require) that `a` is not a unique attribute. |
| `has(a)`  | Provides a table function `.has_a(value): boolean` that returns true if there is an item with `a=value` |
| `each`  | Provides a table function `.each(): Iterator<Item>` that iterates across every item. |
| `listAll` | Provides a table function `.listAll(): Array<Item>` that returns an array of every item. |
| `delete(a)` | Provides a table function `.delete_with_a(value)` that deletes every item where `a=value` |
| `deleteAll` | Provides a table function `.deleteAll()` that deletes every item in the table. |
| `replaceAll` | Provides a table function `.replaceAll(items: Array<Item>)` that deletes every item and replaces them with the given list |
| `count` | Provides a table function `.count(): number` that returns a count of items in the table. |
| `listen` | Returns a Stream object that receives change events for every item change. |
| `getStatus` | The table will have a Status table which is used by `streamToTable`. The Status table keeps track of whether the table data is still loading or has an error. |
| `listenToStream` | Provides a table function `.listenToStream(stream)`. |
| `diff` | Provides a table function `.diff(compare: Table)` which lists all the item diffs between this table and the compare. |
| `get` | Provides a table function `.get(): Item` that returns the table's single item. Implies that the table is a single value table. |
| `set` | Provides a table function `.set(item: Item)` that assigns the table's single item. Implies that the table is a single value table. |
