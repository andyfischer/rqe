<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [rqe](./rqe.md) &gt; [Graph](./rqe.graph.md)

## Graph class

<b>Signature:</b>

```typescript
export declare class Graph 
```

## Constructors

|  Constructor | Modifiers | Description |
|  --- | --- | --- |
|  [(constructor)()](./rqe.graph._constructor_.md) |  | Constructs a new instance of the <code>Graph</code> class |

## Properties

|  Property | Modifiers | Type | Description |
|  --- | --- | --- | --- |
|  [anonTableName](./rqe.graph.anontablename.md) |  | IDSource |  |
|  [customVerbs](./rqe.graph.customverbs.md) |  | [Table](./rqe.table.md)<!-- -->&lt;{ name: string; def: Verb; }&gt; |  |
|  [graphId](./rqe.graph.graphid.md) |  | string |  |
|  [logging](./rqe.graph.logging.md) |  | EmptyLoggingSubsystem |  |
|  [modules](./rqe.graph.modules.md) |  | Module\[\] |  |
|  [modulesById](./rqe.graph.modulesbyid.md) |  | Map&lt;string, Module&gt; |  |
|  [nextModuleId](./rqe.graph.nextmoduleid.md) |  | IDSource |  |
|  [nextTableId](./rqe.graph.nexttableid.md) |  | IDSource |  |
|  [providerTable](./rqe.graph.providertable.md) |  | [Table](./rqe.table.md)<!-- -->&lt;Provider&gt; |  |
|  [schemaListeners](./rqe.graph.schemalisteners.md) |  | ItemChangeListener\[\] |  |
|  [tableRedefineOnExistingName](./rqe.graph.tableredefineonexistingname.md) |  | boolean |  |
|  [tables](./rqe.graph.tables.md) |  | Map&lt;string, [Table](./rqe.table.md)<!-- -->&lt;any&gt;&gt; |  |
|  [tablesByName](./rqe.graph.tablesbyname.md) |  | Map&lt;string, [Table](./rqe.table.md)<!-- -->&lt;any&gt;&gt; |  |

## Methods

|  Method | Modifiers | Description |
|  --- | --- | --- |
|  [addCustomVerb(name, def)](./rqe.graph.addcustomverb.md) |  |  |
|  [addSchemaListener(listener, { backlog })](./rqe.graph.addschemalistener.md) |  |  |
|  [addTable(table, opts)](./rqe.graph.addtable.md) |  |  |
|  [applyTransform(items, queryLike)](./rqe.graph.applytransform.md) |  |  |
|  [callPrepared(prepared, values)](./rqe.graph.callprepared.md) |  |  |
|  [createEmptyModule()](./rqe.graph.createemptymodule.md) |  |  |
|  [createModule(setup)](./rqe.graph.createmodule.md) |  |  |
|  [enableLogging()](./rqe.graph.enablelogging.md) |  |  |
|  [everyMountPoint()](./rqe.graph.everymountpoint.md) |  |  |
|  [everyTable()](./rqe.graph.everytable.md) |  |  |
|  [findTableByName(name)](./rqe.graph.findtablebyname.md) |  |  |
|  [func(decl, callback)](./rqe.graph.func.md) |  |  |
|  [getMountPoint(ref)](./rqe.graph.getmountpoint.md) |  |  |
|  [getQueryMountMatches(tuple)](./rqe.graph.getquerymountmatches.md) |  |  |
|  [getVerb(name)](./rqe.graph.getverb.md) |  |  |
|  [mountList(config)](./rqe.graph.mountlist.md) |  |  |
|  [mountMap(config)](./rqe.graph.mountmap.md) |  |  |
|  [mountObject(config)](./rqe.graph.mountobject.md) |  |  |
|  [mountTable(table)](./rqe.graph.mounttable.md) |  |  |
|  [newTable(schema)](./rqe.graph.newtable.md) |  |  |
|  [prepareQuery(queryLike)](./rqe.graph.preparequery.md) |  |  |
|  [prepareTransform(queryLike)](./rqe.graph.preparetransform.md) |  |  |
|  [providers()](./rqe.graph.providers.md) |  |  |
|  [put(object)](./rqe.graph.put.md) |  |  |
|  [query(queryLike, parameters, context)](./rqe.graph.query.md) |  |  |
|  [setupBrowse()](./rqe.graph.setupbrowse.md) |  |  |
|  [str(options)](./rqe.graph.str.md) |  |  |
|  [tablesIt()](./rqe.graph.tablesit.md) |  |  |

