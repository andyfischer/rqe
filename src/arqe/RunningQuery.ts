
import { PlannedQuery } from './PlannedQuery'
import { Stream } from './Stream'
import { Step } from './Step'
import { Graph } from './Graph'
import { getVerb } from './verbs/_list'
import { Query, QueryTuple } from './Query'
import { Block, executeBlock, Input } from './Block'
import { prepareTableSearch, MountPointRef } from './PlannedQuery'
import { MountPoint } from './MountPoint'
import { QueryExecutionContext } from './Graph'

export class RunningQuery {
    graph: Graph
    planned: PlannedQuery
    context: QueryExecutionContext
    input: Stream
    parameters: any
    env: { [key: string]: any }
    steps: Step[]

    output = new Stream()

    constructor(graph: Graph, planned: PlannedQuery, context: QueryExecutionContext) {
        this.graph = graph;
        this.planned = planned;
        this.parameters = context.parameters;
        this.env = context.env;
        this.input = context.input;
        this.context = context;
        this.run();
    }

    private run() {

        if (this.graph && this.graph.logging.isEnabled()) {
            this.graph.logging.put('planning', `executing planned query:\n${this.planned.toLinkedBlock().str({ omitHeader: true })}`);
        }

        const input = this.input || Stream.newEmptyStream();

        let previousOutput = input;

        const steps: Step[] = [];
        
        for (const plannedStep of this.planned.steps) {
            const output = new Stream();

            const step = new Step({
                id: plannedStep.id,
                graph: this.graph,
                tuple: plannedStep.tuple,
                input: previousOutput,
                output,
                planned: this.planned,
                plannedStep,
                running: this,
                context: this.context,
            });

            steps.push(step);

            previousOutput = output;
        }

        // Connect last output to RunningQuery.output.
        if (steps.length > 0)
            steps[steps.length - 1].output.sendTo(this.output);
        else
            input.sendTo(this.output);

        this.steps = steps;

        // Send all errors that happened in the planning phase.
        if (this.planned.errors) {
            for (const item of this.planned.errors.scan())
                this.output.putError(item);
        }

        // Start the actual execution steps.
        for (const step of steps)
            this.runOneStep(step);
    }

    private runOneStep(step: Step) {
        const verbDef = getVerb(step.verb);
        if (!verbDef)
            throw new Error("verb not found: " + step.verb);

        let handler = verbDef.run;

        if (!handler && verbDef.runUsingBlock) {
            // console.log(step.plannedStep.block.str())
            handler = (step: Step) => executeBlock(step.plannedStep.block, { step, graph: this.graph });
        }

        try {
            handler(step);
        } catch (e) {
            step.output.closeWithUnhandledError(e);
        }

        return step;
    }
}

export function runQuery(graph: Graph, query: Query, input: Stream): Stream {
    const planned = new PlannedQuery(graph, query, {});
    const running = new RunningQuery(graph, planned, { input });
    return running.output;
}

export function runTableSearch(step: Step) {
    const block = new Block();
    prepareTableSearch(step, block.namedInput('step'), block);
    executeBlock(block, { step, graph: step.graph });
}

export function callMountPoint(graph: Graph, context: QueryExecutionContext, pointRef: MountPointRef, tuple: QueryTuple, input: Stream, output: Stream) {

    let step = new Step({
        graph,
        tuple,
        input,
        output,
        context,
    });

    const point = graph.getMountPoint(pointRef);
    if (!point)
        throw new Error("mount point ref not resolved: " + JSON.stringify(pointRef));

    if (!point.attrs)
        throw new Error("not a valid MountPoint object: " + point);

    // Add in the point's assumeInclude tags
    const assumeIncludeTags = [];

    for (const [ attr, attrConfig ] of point.attrs.entries()) {
        if (attrConfig.assumeInclude && !step.has(attr)) {
            assumeIncludeTags.push(attr);
        }
    }

    if (assumeIncludeTags.length > 0) {
        step = step.withTags(
            step.tags.concat(
                assumeIncludeTags.map(attr => ({ t: 'tag', attr, value: { t: 'no_value'} }))
            )
        )
    }

    // Filter the output to only include mentioned tags.
    if (!step.hasStar()) {
        let downstream = step.output;

        let filtering = new Stream();
        filtering.sendTo({
            receive(data) {
                if (data.t === 'item') {
                    const fixedItem: any = {};
                    let anyKeys = false;

                    for (const [key, value] of Object.entries(data.item)) {
                        if (step.has(key)) {
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

        step = step.withOutput(filtering);
    }

    point.callWithParams(step);
}

export function runQueryWithProvider(graph: Graph, providerId: string, query: Query, input: Stream): Stream {

    if (!graph.providerTable) {
        const out = new Stream();
        out.putError({ errorType: 'provider_not_found', message: "Provider not found: " + providerId });
        out.done();
        return out;
    }

    const provider = graph.providers().one({ provider_id: providerId });

    if (!provider) {
        const out = new Stream();
        out.putError({ errorType: 'provider_not_found', message: "Provider not found: " + providerId });
        out.done();
        return out;
    }

    return provider.runQuery(query, input);
}
