
import { Query, QueryStep, QueryTag } from './Query'
import { Stream, joinStreams } from './Stream'
import { getVerbHandler } from './verbs/_list'
import Params from './Params'
import { Scope } from './Scope'
import { HandlerCallback, MountPoint } from './Mounts'
import { explainWhyQueryFails } from './Explain'
import { everyBuiltinTable } from './builtinTables'
import { Item } from './Item'

interface RunQueryOptions {
    input: Stream
    params: any
}

function callMountPoint(table: MountPoint, params: Params) {

    // Add in the table's assumeInclude tags
    const assumeIncludeTags = [];

    for (const [ attr, attrConfig ] of table.attrs.entries()) {
        if (attrConfig.assumeInclude && !params.has(attr)) {
            assumeIncludeTags.push(attr);
        }
    }

    if (assumeIncludeTags.length > 0) {
        params = params.withTags(
            params.tags.concat(
                assumeIncludeTags.map(attr => ({ t: 'queryTag', attr, value: { t: 'noValue'} }))
            )
        )
    }

    // Filter the output to only include mentioned tags.
    if (!params.hasStar()) {
        let downstream = params.output;

        let filtering = new Stream();
        filtering.sendTo({
            receive(data) {
                if (data.t === 'item') {
                    const fixedItem: any = {};
                    let anyKeys = false;

                    for (const [key, value] of Object.entries(data.item)) {
                        if (params.has(key)) {
                            fixedItem[key] = value;
                            anyKeys = true;
                        }
                    }

                    if (anyKeys)
                        downstream.receive({t: 'item', item: fixedItem});

                } else {
                    downstream.receive(data);
                }
            }
        });

        params = params.withOutput(filtering);
    }

    table.callWithParams(params);
}

function runSearchQueryUsingFrom(params: Params) {
    const tableName = params.get("from");
    const table = params.graph.findTableByName(tableName);

    let remainingCommand = params.dropAttr('from');

    if (!table) {
        params.output.sendWarning("TableNotFound", tableName);
        params.output.done();
        return;
    }

    if (params.hasStar()) {
        remainingCommand = remainingCommand.dropStar();

        const missingAttrs = [];
        
        for (const attr of table.attrs.keys()) {
            if (!params.has(attr))
                missingAttrs.push(attr);
        }

        remainingCommand = remainingCommand.addAttrs(missingAttrs);
    }

    if (!table.overlapsQuery(remainingCommand.tags)) {
        const { missingRequired, missingRequiredValue, extraAttrs } = explainWhyQueryFails(remainingCommand, table);

        if (missingRequired.length > 0)
            params.output.sendWarning("MissingAttrs",
                                      "Missing required attr(s): " + missingRequired.join(','));

        if (missingRequiredValue.length > 0)
            params.output.sendWarning("MissingValue",
                                      "Missing value for attr(s): " + missingRequiredValue.join(','));

        if (extraAttrs.length > 0)
            params.output.sendWarning("ExtraAttrs",
                                      "Table doesn't provide attr(s): " + extraAttrs.join(','));
        params.output.done();
        return;
    }

    callMountPoint(table, remainingCommand);
}

function findMatchingMountPoints(params: Params) {
    const { graph, tags, output } = params;

    let mounts: MountPoint[] = [];
    let hasRetried = false;

    maybe_retry: while (true) {
        for (const table of graph.everyTable()) {
            if (!table.overlapsQuery(tags))
                continue;

            mounts.push(table);
        }

        // Maybe load a builtin mount
        if (mounts.length === 0 && params.tags.length === 1 && everyBuiltinTable[params.tags[0].attr]) {
            everyBuiltinTable[params.tags[0].attr](params.graph);
            
            if (!hasRetried) {
                hasRetried = true;
                continue maybe_retry;
            }
        }

        break maybe_retry;
    }

    return mounts;
}

export function runTableSearch(params: Params) {

    const { graph, tags, output } = params;

    if (params.has('from')) {
        return runSearchQueryUsingFrom(params);
    }

    let mounts = findMatchingMountPoints(params);

    if (mounts.length === 0) {
        output.sendWarning('NoTableFound');
        output.done();
        return;
    }

    if (mounts.length === 1) {
        callMountPoint(mounts[0], params);
        return;
    }

    // Join results from multiple mounts.
    const { receivers, stream } = joinStreams(mounts.length);
    stream.sendTo(output);

    for (let i = 0; i < mounts.length; i++) {
        const singleStream = new Stream();
        singleStream.sendTo(receivers[i]);
        callMountPoint(mounts[i], params.withOutput(singleStream));
    }
}

function runSingleQuery(scope: Scope, query: QueryStep, input: Stream) {
    const step = new Params({
        graph: scope.graph,
        scope,
        tags: query.tags,
        verb: query.verb,
        input,
        output: new Stream()
    });

    const handler = getVerbHandler(step.verb);

    if (!handler) {
        step.output.closeWithError("verb not recognized: " + step.verb);
        return step;
    }

    try {
        handler(step);
    } catch (e) {
        step.output.closeWithUnhandledError(e);
    }

    return step;
}

export function runPipedQuery(scope: Scope, query: Query, input: Stream): Stream {

    const steps: Params[] = [];
    
    if (query.steps.length === 0) {
        return Stream.newEmptyStream();
    }

    for (let index=0; index < query.steps.length; index++) {
        let previousStream = ((index === 0) ? input : steps[index - 1].output);
        const queryStep = query.steps[index];
        const step = runSingleQuery(scope, queryStep, previousStream);
        steps.push(step);
    }

    return steps[steps.length - 1].output;
}
