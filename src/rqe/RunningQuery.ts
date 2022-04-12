
import { PlannedQuery } from './Planning'
import { Stream } from './Stream'
import { Step } from './Step'
import { Graph } from './Graph'
import { Query, injectParametersIntoQuery, errorOnUnfilledParameters } from './Query'
import { QueryExecutionContext, QueryParameters } from './Graph'
import { getVerb } from './verbs/_list'
import { queryStepToString } from './Query'

export class RunningQuery {
    graph: Graph
    planned: PlannedQuery
    context: QueryExecutionContext
    input: Stream
    parameters: any
    env: { [key: string]: any }
    steps: Step[]

    output = new Stream('RunningQuery overall output')

    constructor(graph: Graph, planned: PlannedQuery, parameters: QueryParameters = {}, context: QueryExecutionContext) {
        this.graph = graph;
        this.planned = planned;
        this.parameters = parameters;
        this.env = context.env;
        this.input = parameters && parameters['$input'] || null;
        this.context = context;
        this.run();
    }

    private run() {

        if (this.graph && this.graph.logging.isEnabled()) {
            // this.graph.logging.put('planning', `executing planned query:\n${this.planned.toLinked().str({ omitHeader: true })}`);
        }

        const input = this.input || Stream.newEmptyStream();

        let previousOutput = input;

        const steps: Step[] = [];
        
        for (const plannedStep of this.planned.steps) {
            const output = new Stream('output of step: ' + plannedStep.id);

            let tuple = plannedStep.tuple;

            tuple = injectParametersIntoQuery(tuple, this.parameters);

            errorOnUnfilledParameters(tuple);

            const step = new Step({
                id: plannedStep.id,
                graph: this.graph,
                tuple: tuple,
                input: previousOutput,
                output,
                planned: this.planned,
                plannedStep,
                running: this,
                context: this.context,
            });

            step.incomingSchema = plannedStep.inputSchema;

            steps.push(step);

            previousOutput = output;
        }

        if (steps.length > 0) {
            // Connect last output to RunningQuery.output.
            steps[steps.length - 1].output.sendTo(this.output);
        } else {
            // No steps - just pass through input -> output.
            input.sendTo(this.output);
        }

        this.steps = steps;

        // Output the schema
        const lastPlannedStep = this.planned.steps[this.planned.steps.length - 1];
        if (lastPlannedStep) {
            for (const item of lastPlannedStep.outputSchema)
                this.output.receive({ t: 'schema', item });
        }

        // Start the actual execution steps.
        for (const step of steps)
            this.runOneStep(step);
    }

    private runOneStep(step: Step) {
        let verbDef = step.plannedStep.verbDef;
        let handler = verbDef.run;

        try {
            handler(step);
        } catch (e) {
            step.output.closeWithUnhandledError(e);
        }

        return step;
    }
}

export function runQuery(graph: Graph, query: Query, parameters: QueryParameters): Stream {
    const planned = new PlannedQuery(graph, query, {});
    const running = new RunningQuery(graph, planned, parameters, {});
    return running.output;
}


export function runQueryWithProvider(graph: Graph, providerId: string, query: Query, input: Stream): Stream {

    if (!graph.providerTable) {
        const out = new Stream('runQueryWithProvider error 1');
        out.putError({ errorType: 'provider_not_found', message: "Provider not found: " + providerId });
        out.done();
        return out;
    }

    const provider = graph.providers().one({ provider_id: providerId });

    if (!provider) {
        const out = new Stream('runQueryWithProvider error 2');
        out.putError({ errorType: 'provider_not_found', message: "Provider not found: " + providerId });
        out.done();
        return out;
    }

    return provider.runQuery(query, input);
}
