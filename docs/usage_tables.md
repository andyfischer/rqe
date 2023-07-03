
# Usage: Tables

A new [Table] object is created by calling schema.createTable()

Each Table has a custom runtime API, depending on what functions were declared in its Schema.

### Functions that are always available

| Name | Description |
| ---- | ----------- |
| `.schema: Schema` | A link to the Schema object that created this table. |
| `.insert(item: Item)` | Insert an item into the table. |
| `.preInsert(item: Item)` | Perform the pre-insert steps (such as assigning `auto` IDs). This is rarely needed, but you might call it if you want to the value of any `auto` created IDs before actually calling `.insert` |

### Functions that can be available based on the schema

These functions are conditionally available, depending on the `funcs` section of the Schema.

Some function names are dynamically created, where the attr name is part of the function name. For example, if the schema declares a func `get(username)`, this
will create a runtime function `.get_with_username(usernameValue)`. Functions like this are documented below with `<attr>` (for example: `.get_with_<attr>`).

| Function | Based on schema declaration | Description |
| ------ | ----------- | ---- |
| `.get_with_<attr>(value): Item`  | `get(attr)` | Returns a single item where `attr=value`.   |
| `.list_with_<attr>(value): Array<Item>`  | `list(attr)` | Returns an array of items where `attr=value`. |
| `.has_<attr>(value): boolean`  | `has(attr)` | Returns true if the table contains an item with `attr=value`.  |
| `.delete_<attr>(value)` | `delete(attr) ` | Deletes any item(s) where `attr=value`. |
| `.get(): Item` | `get` | Gets the table's single value. |
| `.set(item: Item)` | `set` | Sets the table's single value to the given item. |
| `.each(): Iterator<Item>`  | `each` | Iterate across every item in the table. |
| `.listAll(): Array<Item>` | `listAll` | Returns an array of every item in the table. |
| `.deleteAll()` | `deleteAll` | Provides a table function `.deleteAll()` that deletes every item in the table. |
| `.replaceAll(items: Array<Item>)` | `replaceAll` | Provides a table function `.replaceAll(items: Array<Item>)` that deletes every item and replaces them with the given list. |
| `.count(): number` | `count` | Returns the number of items in the table. |
| `.listen(): Stream` | `listen` | Returns a Stream object that receives change events for every item change. |
| `.listenToStream(stream: Stream)` | `listenToStream` | This table will start listening to the given stream, and will populate the table's contents based on the received items. |
| `.diff(compare: Table)` | `diff` | Returns a list of differences between the items in this table and the compare table. |

## Functions that are available when the Status table is enabled.

If the Schema is declared with a func `getStatus` then the Table will have a hidden "status" table enabled. The
status table keeps track of the loading progress, and the table's status is either `done` or `loading` or `error`.
This is useful when the table is being populated using a remote call, or any other situation where the table
contents are being streamed in (such as with `listenToStream`);

If the table has a Status table enabled then these members and functions are available:

| Name | Description |
| ---- | ----------- |
| `.status: Table` | The Table object that stores the table's status. |
| `.isLoading(): boolean` | Whether the table is still in `loading` status. |
| `.hasError(): boolean` | Whether the table has an `error` status. |
| `.waitForData(): Promise` | Returns a Promise that resolves once the table is finished loading. |


## Functions that are available when there is a unique attribute

During compilation, the system will try to find a "primary unique attribute", which is an attribute that is known to be unique.

Currently this will look for the first map-based index and use that. Map-based indexes are created by declaring a `get(x)` function.

If the table does have a primary unique attribute, then these functions are available:

| Function | Description |
| ---- | ----------- |
| `item_to_uniqueKey(item: Item)` | For an item, return a unique key (using the value for the primary unique attribute). |
| `item_matches_uniqueKey(item: Item, value): boolean` | Returns true if this item matches the given value (using the primary unique attribute) |
| `get_using_uniqueKey(value): Item` | Fetch the item matching this value (using the primary unique attribute) |

## Debugging and troubleshooting

Functions that are always available for debugging.

| Function | Description |
| -------- | ----------- |
| `.consoleLog()` | Print the contents of the table to console.log. |
| `.checkInvariants()` | Run some checks to verify the correctness of the table's internal storage. |
| `.supportFuncs(name: string): string` | Returns whether this table supports a function with this name. |
