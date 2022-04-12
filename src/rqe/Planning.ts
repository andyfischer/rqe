
import { Step } from './Step'
import { Table } from './Table'
import { Graph } from './Graph'
import { Query, QueryStep } from './Query'
import { Stream } from './Stream'
import { ErrorItem } from './Errors'
import { IDSourceNumber as IDSource } from './utils/IDSource'
import { Item } from './Item'
import { QueryExecutionContext } from './Graph'
import { getVerb } from './verbs/_list'
import { has } from './Item'
import { findBestPointMatch } from './FindMatch'
import { planToString } from './Debug'
import { Verb } from './verbs/_shared'
import { MountPointRef } from './FindMatch'

export interface PlannedStep {
    id: number
    tuple: QueryStep

    verbDef: Verb
    inputSchema: Item[]
    outputSchema: Item[]
    sawUsedMounts: MountPointRef[]
    errors: ErrorItem[]
}

interface LinkedQuery {
    jsCode: string
}

type QueryHandlerFunction = (graph: Graph, context: QueryExecutionContext, input: Stream, output: Stream) => void

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

    getPrepareErrors(): Table {
        const out = new Table({});

        for (const step of this.steps) {
            for (const error of step.errors) {
                out.put({
                    ...error,
                    step: step.id,
                    phase: 'prepare',
                });
            }
        }
        
        return out;
    }

    str() {
        return planToString(this);
    }
}

export function createOnePlannedStep(plannedQuery: PlannedQuery, tuple: QueryStep, previousPrepareOutput: Item[]): PlannedStep {

    const { graph } = plannedQuery;

    const id = plannedQuery.stepIds.take();

    // Call .prepare
    let verbDef = plannedQuery.graph ? plannedQuery.graph.getVerb(tuple.verb) : getVerb(tuple.verb);

    if (!verbDef) {
        // Assume it's a join
        verbDef = plannedQuery.graph ? plannedQuery.graph.getVerb('join') : getVerb('join');

        // Fix the tuple
        tuple = {
            t: 'step',
            verb: 'join',
            attrs: {
                [tuple.verb]: {
                    t: 'tag',
                    value: { t: 'no_value' }
                },
                ...tuple.attrs,
            }
        }
    }

    const step: PlannedStep = {
        id,
        tuple,
        verbDef,
        inputSchema: previousPrepareOutput,
        outputSchema: [],
        errors: [],
        sawUsedMounts: [],
    }

    const schemaStream = runStepToGetSchema(plannedQuery, step);
    const [ output, errors ] = schemaStream.takeItemsAndErrors();
    step.outputSchema = output;
    step.errors = errors;

    return step;
}

function replaceOnePlannedStep(plannedQuery: PlannedQuery, steps: PlannedStep[], stepIndex: number, newTuple: QueryStep) {
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
                const enhancedTuple: QueryStep = {
                    t: 'step',
                    verb: step.tuple.verb,
                    attrs: {
                        ...step.tuple.attrs,
                        [attr]: { t: 'tag', value: { t: 'no_value' } },
                    }
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

    // Handle 'need' verbs
    for (let stepIndex=0; stepIndex < steps.length; stepIndex++) {
        const step = steps[stepIndex];

        if (step.tuple.verb === 'need') {
            for (const attr of Object.keys(step.tuple.attrs))
                bringInAttr(stepIndex - 1, attr);
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
    let wipProviderQuery: QueryStep = null;

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
        wipProviderQuery.attrs['query'] = {
            t: 'tag',
            value: wipProviderRemoteQuery,
        };

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
                t: 'query',
                steps: [],
            }

            wipProviderQuery = {
                t: 'step',
                verb: 'run_query_with_provider',
                attrs: {
                    provider_id: {
                        t: 'tag',
                        value: {
                            t: 'str_value',
                            str: providerId
                        },
                    }
                }
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
}

function findProviderUsedByStep(plannedQuery: PlannedQuery, step: PlannedStep) {
    const providers = new Map();

    for (const usedMountRef of (step.sawUsedMounts || [])) {
        const point = plannedQuery.graph.getMountPoint(usedMountRef);
        providers.set(point.providerId, true);
    }

    if (providers.size > 1)
        console.warn('step uses multiple providers?', step.tuple);

    const providersList = Array.from(providers.keys());
    return providersList[0];
}

export function runStepToGetSchema(plannedQuery: PlannedQuery, plannedStep: PlannedStep): Stream {

    const input = Stream.fromList(plannedStep.inputSchema);
    const output = new Stream();

    const step = new Step({
        graph: plannedQuery.graph,
        context: plannedQuery.context,
        tuple: plannedStep.tuple,
        id: plannedStep.id,
        input,
        output,
    });

    step.incomingSchema = plannedStep.inputSchema;
    step.schemaOnly = true;

    plannedStep.verbDef.run(step);

    output.sendDoneIfNeeded();
    plannedStep.sawUsedMounts = step.sawUsedMounts;
    
    return output;
}
