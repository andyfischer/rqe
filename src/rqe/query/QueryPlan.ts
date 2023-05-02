
import { StreamSchema } from '../Stream'
// import { QueryParameters } from '.'
import { Query } from '../query'
import { Stream } from '../Stream'
import { findVerbForQuery } from './findVerbForQuery'
import { Graph } from '../graph'
// import { Trace } from '../Trace'
import { findBestPointMatch, errorForNoTableFound } from '../query/FindMatch'
// import { unwrapTagged } from '../TaggedValue'
// import { NativeCallback } from '../handler'
import { Task } from '../task'
// import { QueryExecutionContext } from '../Graph'
import { ErrorItem } from '../Errors'
// import { runNativeFunc2 } from '../NativeCallback'
import { Handler } from '../handler'
import { Verb } from './Verb'
// import { toStructuredString } from '../Debug'
import { formatItem } from '../Format'
// import { completePlanJoinVerb, JoinPlan } from '../query/Join'
import { VerboseLogEveryPlanExecution } from '../config'
import { IndentPrinter } from '../utils/IndentPrinter'
import { logPlanToConsole } from './logPlanToConsole'
import { JoinPlan } from './Join'
import { TaskCallback } from '../task/runTaskCallback'

type QueryExecutionContext = any;
type QueryParameters = any;
type NativeCallback = Function;

/*
 
Runtime query execution process:

PREPARE INPUTS phase
 - Collect inputs (either from query or params)
 - Expand query to include "assume include" tags (is this planning?)
 - Check if required params are provided
   - ERROR if not
 
PRE RUN MATCH CHECK
 
 - If an attr is overprovided
   - Modify inputs to not send a value for that attr
   - Include a performance warning?

PRE RUN
 - Output schema

ERROR EARLY EXIT
 - If there's an error, output error message and stop

RUN
 - Call native func
 - Or perform custom verb
 - Or perform join logic

POST FILTER
 - If attr is overprovided, then drop items that don't match the filter

POST RESHAPE
 - Reorder the object to match the query
 - Remove attrs that aren't requested by the query
   - Second filter: Drop the item if none of its attrs were requested
 - Assign attrs that are missing in the item but present in the query (or params)
   - Don't include query attrs that are optional & unused in the mount
 */

export interface NoInputExpected {
    t: 'no_value'
}

export interface SomeInputExpected {
    t: 'some_value'
}

export interface ExpectedSingleValue {
    t: 'expected_value'
    value: Query
}

export interface ExpectedUnionValue {
    t: 'expected_union'
    values: Query[]
}


export type ExpectedValue = NoInputExpected | SomeInputExpected | ExpectedSingleValue | ExpectedUnionValue

export class Plan {
    // Context
    graph: Graph
    query: Query
    verb: string
    context: QueryExecutionContext
    expectedInput: ExpectedValue

    // Derived context, used during planning.
    /*
    afterVerb: QueryTuple
    point: MountPoint
    */
    expectedOutput: ExpectedValue

    // Runtime data:

    // Check/prepare inputs
    checkRequiredParams: string[]
    overprovidedAttrs: string[]
    paramsFromQuery: Map<string,any>

    // Start results
    outputSchema: StreamSchema

    // Run mount
    nativeCallback: TaskCallback | null
    joinPlan?: JoinPlan

    // Post filter
    outputFilters: OutputFilter[]

    // Exceptional cases
    knownError?: ErrorItem
}

export type OutputFilter = OutputFilterReshape | OutputFilterWhereAttrsEqual

export interface OutputFilterReshape {
    t: 'reshape'
    shape: OutputAttr[]
}

export interface OutputFilterWhereAttrsEqual {
    t: 'whereAttrsEqual'
    attrs: Array<OutputAttrConstant | OutputAttrFromParam>
}

type OutputAttr = OutputAttrFromItem | OutputAttrFromParam | OutputAttrConstant;

interface OutputAttrFromItem {
    t: 'from_item'
    attr: string
}

interface OutputAttrFromParam {
    t: 'from_param'
    attr: string
}

interface OutputAttrConstant {
    t: 'constant'
    attr: string
    value: any
}

export type ExecutionType = 'normal' | 'schemaOnly'

export function createPlan(graph: Graph, context: QueryExecutionContext, query: Query, expectedInput: ExpectedValue): Plan {

    //const trace = new Trace();
    query.freeze();

    const { verbDef, verbName, afterVerb } = findVerbForQuery(graph, query, expectedInput);

    const plan: Plan = {
        graph,
        context,
        query,
        expectedInput,
        verb: verbName || verbDef.name,
        checkRequiredParams: [],
        paramsFromQuery: new Map(),
        overprovidedAttrs: [],
        outputSchema: null,
        nativeCallback: null,
        outputFilters: [],
        expectedOutput: null,
    }

    validatePlan(plan);

    /*
    if (plan.verb === 'get') {
        // future refactor: findBestPointMatch doesn't need to worry about the overprovided check
        const match = findBestPointMatch(graph, trace, tuple);
        const point = match?.point;
        completePlanGetVerb(plan, point);
    } else if (plan.verb === 'join') {
        completePlanJoinVerb(plan);
    } else if (plan.verb === 'where') {
        plan.nativeCallback = verbDef.run;
        plan.expectedOutput = plan.expectedInput;
    } else {
        completePlanAltVerb(plan, verbDef);
    }
    validatePlan(plan);
    */

    return plan;
}

/*
function completePlanGetVerb(plan: Plan, point: MountPoint) {
    if (!point) {
        plan.expectedOutput = { t: 'some_value' };
        plan.knownError = errorForNoTableFound(plan.graph, plan.trace, plan.tuple);
        return plan;
    }

    plan.point = point;

    // Check/prepare inputs
    const outputShape: OutputAttr[] = []
    plan.outputFilters.push({ t: 'reshape', shape: outputShape });
    let overprovidedFilter: OutputFilterWhereAttrsEqual = null;

    // Check each tag requested by query
    for (const queryTag of plan.tuple.tags) {
        const attr = queryTag.attr;
        const mountTag = point.attrs[attr];
        const queryProvidesValue = queryTag.value.t !== 'no_value';
        const queryProvidedValue = queryProvidesValue ? unwrapTagged(queryTag.value) : null;
        const willHaveValueForThisAttr = queryProvidesValue || queryTag.identifier;

        let isRequiredParam = false;
        if (mountTag && mountTag.requiresValue && !queryProvidesValue)
            isRequiredParam = true;

        if (queryTag.identifier && !queryProvidesValue)
            isRequiredParam = true;

        if (isRequiredParam)
            plan.checkRequiredParams.push(attr);

        if (queryProvidesValue)
            plan.paramsFromQuery.set(attr, queryProvidedValue);

        if (plan.graph.enableOverprovideFilter) {
            if (willHaveValueForThisAttr && mountTag && (!mountTag.requiresValue && !mountTag.acceptsValue)) {
                plan.overprovidedAttrs.push(attr);

                if (!overprovidedFilter) {
                    overprovidedFilter = { t: 'whereAttrsEqual', attrs: [] }
                    plan.outputFilters.push(overprovidedFilter);
                }

                if (queryProvidesValue)
                    overprovidedFilter.attrs.push({ t: 'constant', attr, value: queryProvidedValue });
                else
                    overprovidedFilter.attrs.push({ t: 'from_param', attr });
            }
        }

        if (!mountTag) {
            // Query has an optional tag and the mount didn't provide it.
        } else if (queryProvidesValue) {
            outputShape.push({ t: 'constant', attr, value: queryProvidedValue})
        } else if (willHaveValueForThisAttr) {
            outputShape.push({ t: 'from_param', attr });
        } else {
            outputShape.push({ t: 'from_item', attr });
        }
    }
    validatePlan(plan);

    plan.expectedOutput = { t: 'expected_value', value: plan.afterVerb }
    plan.outputSchema = plan.afterVerb.toItemValue();

    if (!point.callback)
        throw new Error("handler doesn't have a callback: " + point.toDeclString());

    plan.nativeCallback = point.callback;
    validatePlan(plan);
}

function completePlanAltVerb(plan: Plan, verb: Verb) {
    plan.nativeCallback = verb.run;
    plan.expectedOutput = getExpectedOutputWithSchemaOnlyExecution(plan);
}

function getExpectedOutputWithSchemaOnlyExecution(plan: Plan): ExpectedValue {

    const input = new Stream();

    switch (plan.expectedInput.t) {
        case 'expected_value':
            input.put(plan.expectedInput.value.toItemValue());
            break;
        case 'expected_union':
            for (const item of plan.expectedInput.values)
                input.put(item);
            break;
    }

    input.done();

    const output = new Stream();
    executePlan(plan, {}, input, output, 'schemaOnly');

    if (!output.isDone()) {
        throw new Error(`schemaOnly execution didn't finish synchronously (verb=${plan.verb}, tuple=${plan.tuple.toQueryString()})`);
    }

    const values = output.take();

    if (values.length === 0)
        return { t: 'no_value' }

    if (values.length > 1) {
        return { t: 'expected_union', values}
    }

    let value = values[0];

    if (value.t !== 'queryTuple') {
        value = QueryTuple.fromItem(value);
    }

    return { t: 'expected_value', value }
}

export function executePlan(plan: Plan, parameters: QueryParameters, input: Stream, output: Stream, executionType: ExecutionType = 'normal') {

    if (VerboseLogEveryPlanExecution) {
        let prefix = 'Executing plan:'
        logPlanToConsole({plan, parameters, prefix, executionType});
    }

    if (plan.knownError) {
        output.sendErrorItem(plan.knownError);
        output.done();
        return;
    }

    // Check for required parameters
    for (const attr of plan.checkRequiredParams) {
        if (!has(parameters, attr)) {
            output.sendErrorItem({
                errorType: 'missing_parameter',
                fromQuery: plan.tuple.toQueryString(),
                data: [{ missingParameterFor: attr }] });
            output.done();
            return;
        }
    }

    let taskOutput = output;

    for (const filter of plan.outputFilters) {
        switch (filter.t) {
        case 'reshape':
            taskOutput = reshapingFilter(plan, parameters, taskOutput, filter);
            break;
        case 'whereAttrsEqual':
            taskOutput = whereAttrsEqualFilter(plan, parameters, taskOutput, filter);
            break;
        }
    }

    const task = new Task({
        graph: plan.graph,
        tuple: plan.tuple,
        afterVerb: plan.afterVerb,
        parameters,
        input,
        output: taskOutput,
        context: plan.context,
        plan3: plan,
        trace: null,
        executionType,
        schemaOnly: executionType === 'schemaOnly',
    });

    if (plan.verb !== 'get')
        task.streaming(); // awkward special case - verbs assume streaming

    if (plan.outputSchema)
        task.output.receive({ t: 'schema', item: plan.outputSchema });

    runNativeFunc2(task, plan.nativeCallback);
}
*/

function validatePlan(plan: Plan) {
    // TODO
    /*
    if (plan.expectedOutput?.t === 'expected_value') {
        if ((plan as any).expectedOutput.value.t !== 'queryTuple') {
            console.error('wrong type: ', plan.expectedOutput.value);
            throw new Error("plan.expectedOutput has wrong type");
        }
    }
    */
}

/*
export function runtimePlanAndExecute(step: Task, tuple: QueryTuple, input: Stream | null, output: Stream) {
    input = input || Stream.newEmptyStream();
    const plan = createPlan(step.graph, step.context, tuple, { t: 'no_value' });

    if (VerboseLogEveryPlanExecution)
        logPlanToConsole({ plan, prefix: 'Runtime plan and execute:', executionType: step.executionType });

    if (step.executionType === 'schemaOnly') {
        output.receive({ t: 'schema', item: plan.outputSchema });
        output.done();
        return;
    }

    executePlan(plan, step.parameters, Stream.newEmptyStream(), output, step.executionType);
}

export function runtimePlanAndExecute2(graph: Graph, context: QueryExecutionContext, tuple: QueryTuple, parameters: QueryParameters, input: Stream | null, output: Stream) {
    const plan = createPlan(graph, context, tuple, { t: 'no_value' });

    if (VerboseLogEveryPlanExecution)
        logPlanToConsole({ plan, prefix: 'runtimePlanAndExecute2:' });

    executePlan(plan, parameters, Stream.newEmptyStream(), output);
}
*/
