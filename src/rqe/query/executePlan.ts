
import { Plan, ExecutionType } from './QueryPlan'
import { Stream } from '../Stream'
import { logPlanToConsole } from './logPlanToConsole'
import { Task } from '../task'
import { VerboseLogEveryPlanExecution } from '../config'
import { runTaskCallback } from '../task/runTaskCallback'

type QueryExecutionContext = any;
type QueryParameters = any;

/*
 function reshapingFilter(plan: Plan, parameters: QueryParameters, output: Stream, filter: OutputFilterReshape): Stream {
    const fixed = new Stream(plan.graph, 'reshaping output for: ' + plan.tuple.toQueryString());

    fixed.sendTo({
        receive(evt) {
            switch (evt.t) {
            case 'item': {
                const item = evt.item;
                const fixedItem = {};
                let usedAnyValuesFromItem = false;

                for (const outputAttr of filter.shape) {
                    const attr = outputAttr.attr;
                    switch (outputAttr.t) {
                    case 'from_item':
                        if (has(item, attr)) {
                            fixedItem[attr] = item[attr];
                            usedAnyValuesFromItem = true;
                        } else {
                            fixedItem[attr] = null;
                        }
                        break;
                    case 'from_param': {
                        fixedItem[attr] = parameters[attr];
                        break;
                    }
                    case 'constant':
                        if (has(item, attr)) {
                            fixedItem[attr] = item[attr];
                        } else {
                            fixedItem[attr] = outputAttr.value;
                        }
                        break;
                    }
                }

                if (plan.overprovidedAttrs.length > 0)
                    // Count the item as "used" even if it's shadowed by overprovided query attrs.
                    usedAnyValuesFromItem = true;

                if (usedAnyValuesFromItem)
                    output.put(fixedItem);

                break;
            }
            default:
                output.receive(evt);
            }
        }
    })

    return fixed;
}

function whereAttrsEqualFilter(plan: Plan, params: QueryParameters, output: Stream, filter: OutputFilterWhereAttrsEqual): Stream {
    const fixed = new Stream(plan.graph, 'reshaping output for: ' + plan.tuple.toQueryString());

    fixed.sendTo({
        receive(evt) {
            switch (evt.t) {
            case 'item': {
                const item = evt.item;

                for (const attrFilter of filter.attrs) {

                    const attr = attrFilter.attr;
                    let valueFromQuery;

                    switch (attrFilter.t) {
                    case 'constant':
                        valueFromQuery = attrFilter.value;
                        break;
                    case 'from_param':
                        valueFromQuery = params[attr];
                        break;
                    }

                    const valueFromItem = get(item, attr);

                    if ((valueFromQuery+'') !== ((valueFromItem)+'')) {
                        return;
                    }
                }
                output.receive(evt);
                break;
            }
            default:
                output.receive(evt);
            }
        }
    })

    return fixed;
}


*/

export function executePlan(plan: Plan, parameters: QueryParameters, input: Stream, output: Stream, executionType: ExecutionType = 'normal') {

    if (VerboseLogEveryPlanExecution) {
        let prefix = 'Executing plan:'
        logPlanToConsole({plan, parameters, prefix, executionType});
    }

    if (plan.knownError) {
        output.putError(plan.knownError);
        output.done();
        return;
    }

    // Check for required parameters
    for (const attr of plan.checkRequiredParams) {
        if (parameters[attr] === undefined) {
            output.putError({
                errorType: 'missing_parameter',
                fromQuery: plan.query.toQueryString(),
                info: { missingParameterFor: attr } });
            output.done();
            return;
        }
    }

    let taskOutput = output;

    for (const filter of plan.outputFilters) {
        switch (filter.t) {
        case 'reshape':
            throw new Error("need to fix: reshapingFilter");
            // taskOutput = reshapingFilter(plan, parameters, taskOutput, filter);
            break;
        case 'whereAttrsEqual':
            throw new Error("need to fix: whereAttrsEqual filter");
            // taskOutput = whereAttrsEqualFilter(plan, parameters, taskOutput, filter);
            break;
        }
    }

    const task = new Task({
        graph: plan.graph,
        query: plan.query,
        // afterVerb: plan.afterVerb,
        queryParameters: parameters,
        input,
        output: taskOutput,
        // context: plan.context,
        //plan: plan,
        //trace: null,
        //executionType,
        //schemaOnly: executionType === 'schemaOnly',
    });

    if (plan.verb !== 'get') {
        throw new Error("fix? task.streaming");
        // task.streaming(); // awkward special case - verbs assume streaming
    }

    if (plan.outputSchema)
        task.output.receive({ t: 'schema', item: plan.outputSchema });

    runTaskCallback(task, plan.nativeCallback);
}

