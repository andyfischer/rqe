
import { Step } from './Step'
import { Table } from './Table'
import { Graph } from './Graph'
import { Query, QueryTuple, queryTupleToString, toQueryTuple, QueryTupleLike,
    queryHasAttr, withoutAttr, withoutStar, withAttrs, tupleGetStringValue,
    tupleHas, tupleHasStar } from './Query'
import { Stream } from './Stream'
import { ErrorItem, newErrorTable } from './Errors'
import { IDSourceNumber as IDSource } from './utils/IDSource'
import { Item } from './Item'
import { MountPoint } from './MountPoint'
import { Block, executeBlockSchemaOnly, LooseInput, runAstModification } from './Block'
import { getQueryMountMatch, QueryMountMatch } from './FindMatch'
import { explainWhyQueryFails } from './Explain'
import { QueryExecutionContext } from './Graph'
import { getVerb } from './verbs/_list'
import { has } from './Item'
import { findBestPointMatch, prepareTableSearch } from './FindMatch'
import { planToString } from './Debug'

export interface PlannedStep {
    id: number
    tuple: QueryTuple

    inputSchema: Item[]
    outputSchema: Item[]
    block: Block
}

export interface PrepareParams {
    graph: Graph
    tuple: QueryTuple
    later: Block
    incomingSchema: Item[]
}

export class PlannedQuery {
    graph: Graph
    query: Query
    context: QueryExecutionContext
    steps: PlannedStep[]
    stepIds = new IDSource()

    constructor(graph: Graph, query: Query, context: QueryExecutionContext = {}) {
        this.graph = graph;
        this.query = query;
        this.context = context;
        this.prepare();
    }

    private prepare() {
        createInitialPlannedSteps(this);
        handlePlanTimeVerbs(this);
        optimizeForProviders(this);
        finalizeBlocks(this);
    }

    getOutputSchema(): Item[] {
        return this.steps[this.steps.length - 1].outputSchema;
    }

    toLinkedBlock(): Block {
        const linked = new Block();

        for (const step of this.steps) {
            linked.comment("start tuple: " + queryTupleToString(step.tuple));
            linked.appendInline(step.block);
        }

        return linked;
    }

    getPrepareErrors(): Table {
        const out = new Table({});

        for (const step of this.steps) {
            if (step.block) {
                for (const error of step.block.errors()) {
                    out.put({
                        ...error,
                        step: step.id,
                        phase: 'prepare',
                    });
                }
            }
        }
        
        return out;
    }

    str() {
        return planToString(this);
    }
}

export function createOnePlannedStep(plannedQuery: PlannedQuery, tuple: QueryTuple, previousPrepareOutput: Item[]): PlannedStep {

    const { graph } = plannedQuery;

    const id = plannedQuery.stepIds.take();

    // Call .prepare
    let verbDef = plannedQuery.graph ? plannedQuery.graph.getVerb(tuple.verb) : getVerb(tuple.verb);
    const block = new Block();

    if (!verbDef) {
        block.put_error(block.namedInput('step_output'), {
            errorType: 'verb_not_found',
            verb: tuple.verb,
        });

        return {
            id,
            tuple,
            inputSchema: previousPrepareOutput,
            outputSchema: [],
            block,
        }
    }

    if (verbDef.prepare)
        verbDef.prepare({graph: plannedQuery.graph, tuple, later: block, incomingSchema: previousPrepareOutput});

    // Do a pass to find out the output schema.
    const schemaOutput = new Stream();
    executeBlockSchemaOnly(block, {
        graph: plannedQuery.graph,
        step_context: plannedQuery.context,
        step_input: Stream.fromList(previousPrepareOutput),
        step_output: schemaOutput,
    });
    schemaOutput.sendDoneIfNeeded();

    return {
        id,
        tuple,
        inputSchema: previousPrepareOutput,
        outputSchema: schemaOutput.take(),
        block,
    }
}

function replaceOnePlannedStep(plannedQuery: PlannedQuery, steps: PlannedStep[], stepIndex: number, newTuple: QueryTuple) {
    const previousStep = steps[stepIndex - 1];
    const previousOutput = (previousStep && previousStep.outputSchema) || [];
    steps[stepIndex] = createOnePlannedStep(plannedQuery, newTuple, previousOutput);
}

export function createInitialPlannedSteps(plannedQuery: PlannedQuery) {
    const { query } = plannedQuery;

    const steps: PlannedStep[] = [];

    if (query.steps.length === 0) {
        plannedQuery.steps = [];
        return;
    }

    // Run .prepare on each step.
    let previousPrepareOutput = [];

    for (const tuple of query.steps) {
        const step = createOnePlannedStep(plannedQuery, tuple, previousPrepareOutput);
        steps.push(step);
        previousPrepareOutput = step.outputSchema;
    }

    plannedQuery.steps = steps;
}

function handlePlanTimeVerbs(plannedQuery: PlannedQuery) {
    const graph = plannedQuery.graph;
    const steps = plannedQuery.steps;
    const fixedSteps: PlannedStep[] = [];

    function bringInAttr(stepIndex: number, attr: string) {
        for (; stepIndex >= 0; stepIndex--) {
            const step = steps[stepIndex];

            // Check if the step's output already has this attr.
            for (const output of step.outputSchema) {
                if (has(output, attr)) {
                    // The attr is already here, we're good.
                    return;
                }
            }

            // Try to pull the attr from this table.
            if (step.tuple.verb === 'get') {
                const enhancedTuple: QueryTuple = {
                    t: 'tuple',
                    verb: step.tuple.verb,
                    tags: step.tuple.tags.concat([{ t: 'tag', attr, value: { t: 'no_value' }}]),
                }

                const existingMatch = findBestPointMatch(graph, step.tuple);
                const enhancedMatch = findBestPointMatch(graph, enhancedTuple);

                // If we still matched to the same table then we're good to enhance this step.
                if (existingMatch && enhancedMatch && existingMatch.point === enhancedMatch.point) {
                    replaceOnePlannedStep(plannedQuery, fixedSteps, stepIndex, enhancedTuple);
                    return;
                }
            }
        }

        // Failed to bring in the attr - TODO is record an error.
    }

    for (let stepIndex=0; stepIndex < steps.length; stepIndex++) {
        const step = steps[stepIndex];

        if (step.tuple.verb === 'need') {
            for (const tag of step.tuple.tags)
                bringInAttr(stepIndex - 1, tag.attr);
            continue;
        }

        fixedSteps.push(step);
    }

    plannedQuery.steps = fixedSteps;
}

function optimizeForProviders(plannedQuery: PlannedQuery) {
    // - Iterate across the PlannedSteps
    // - Check to see if any steps use mounts that have a providerId. We figure this out by
    //   looking at the block AST.
    // - If so, those steps are converted (and grouped, if multiple) into a run_query_with_provider step.

    const fixedSteps: PlannedStep[] = [];
    let wipProviderId: string = null;
    let wipProviderRemoteQuery: Query = null;
    let wipProviderQuery: QueryTuple = null;

    function finishInProgressProviderQuery() {
        if (!wipProviderQuery)
            return;

        if (wipProviderRemoteQuery.steps.length === 0) {
            wipProviderId = null;
            wipProviderQuery = null;
            wipProviderRemoteQuery = null;
            return;
        }

        // Save the wipProviderQuery that was in progress.
        wipProviderQuery.tags.push({
            t: 'tag',
            attr: 'query',
            value: {
                t: 'query_value',
                query: wipProviderRemoteQuery,
            },
        });

        const insertStep = createOnePlannedStep(plannedQuery, wipProviderQuery, []);
        // console.log('created step for provider: ', JSON.stringify(wipProviderQuery, null, 2));
        fixedSteps.push(insertStep);
        wipProviderId = null;
        wipProviderQuery = null;
        wipProviderRemoteQuery = null;
    }

    for (const step of plannedQuery.steps) {
        const providerId = findProviderUsedByStep(plannedQuery, step);

        if (providerId && providerId !== wipProviderId) {
            finishInProgressProviderQuery();

            wipProviderId = providerId;

            wipProviderRemoteQuery = {
                t: 'pipedQuery',
                steps: [],
            }

            wipProviderQuery = {
                t: 'tuple',
                verb: 'run_query_with_provider',
                tags: [{
                    t: 'tag',
                    attr: 'provider_id',
                    value: {
                        t: 'str_value',
                        str: providerId
                    },
                }],
            };
        }

        if (wipProviderQuery) {
            wipProviderRemoteQuery.steps.push(step.tuple);
        } else {
            fixedSteps.push(step);
        }
    }

    finishInProgressProviderQuery();
    plannedQuery.steps = fixedSteps;
}

function finalizeBlocks(plannedQuery: PlannedQuery) {
    if (plannedQuery.context.mod) {
        // run the AstModification on every step.
        for (const step of plannedQuery.steps) {
            step.block = runAstModification(plannedQuery.graph, step.block, plannedQuery.context.mod);
        }
    }
}

function findProviderUsedByStep(plannedQuery: PlannedQuery, step: PlannedStep) {
    const providers = new Map();
    const block = step.block;

    if (!block || !block.terms)
        return null;

    for (const term of block.terms) {
        if (term.f === 'call_mount_point') {
            const mountPointRef = block.getStaticValue(term.inputs[2]);
            const point = plannedQuery.graph.getMountPoint(mountPointRef);
            providers.set(point.providerId, true);
            //console.log(`${JSON.stringify(step.tuple)} calls: ${JSON.stringify(mountPointRef)}`);
        }
    }

    if (providers.size > 1)
        console.warn('step uses multiple providers?', step.tuple);

    const providersList = Array.from(providers.keys());
    return providersList[0];
}
