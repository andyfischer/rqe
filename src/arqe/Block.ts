
import { callMountPoint, runQueryWithProvider } from './RunningQuery'
import { MountPoint } from './MountPoint'
import { MountPointRef } from './PlannedQuery'
import { Step } from './Step'
import { Stream, joinStreams } from './Stream'
import { blockToString } from './Debug'
import { Query, QueryTuple } from './Query'
import { Graph } from './Graph'
import { ErrorItem } from './Errors'
import { IDSourceNumber as IDSource } from './utils/IDSource'

interface BlockInput {
    t: 'block_input'
    name: string
}

interface ValueInput {
    t: 'value'
    value: any
}

interface CreatedTerm {
    t: 'created_term'
    term: Term
}

interface LocalInput {
    t: 'local_input'
    id: number
}

export type LooseInput = BlockInput | ValueInput | CreatedTerm | LocalInput | any
export type Input = BlockInput | ValueInput | LocalInput

export interface Term {
    f: string
    id?: number
    inputs: Input[]
    comment?: string
}

const builtinFunctions = {
    call_mount_point: (point: MountPointRef, step: Step) => {
        callMountPoint(step.graph, step.context, point, step.tuple, step.input, step.output);
    },
    call_mount_point2: (point: MountPointRef, graph: Graph, tuple: QueryTuple, input: Stream, output: Stream) => {
        // callMountPoint(graph, point, step);
    },
    output_done: (step: Step) => {
        step.output.done();
    },
    join_streams: (count, output) => {
        const { receivers, stream } = joinStreams(count);
        stream.sendTo(output);
        return receivers;
    },
    run_query_with_provider: (graph: Graph, providerId: string, query: Query, input: Stream) => {
        return runQueryWithProvider(graph, providerId, query, input);
    },
    get_index: (list, index) => list[index],
    new_stream: () => new Stream(),
    new_empty_stream: () => Stream.newEmptyStream(),
    put_error: (stream: Stream, error: ErrorItem) => stream.putError(error),
    close_stream: (stream: Stream) => stream.done(),
    step_input: (step: Step) => { return step.input; },
    step_output: (step) => { return step.output; },
    step_without_attr: (step: Step, attr: string) => step.dropAttr(attr),
    step_with_verb: (step: Step, verb: string) => step.withVerb(verb),
    step_with_input: (step: Step, input: Stream) => step.withInput(input),
    step_with_output: (step: Step, output: Stream) => step.withOutput(output),
    send_to: (stream: Stream, output: Stream) => stream.sendTo(output),
}

export class Block {
    terms: Term[] = []
    nextTermId = new IDSource()
    termsById = new Map<number, Term>()

    queuedComment: string

    namedInput(name: string): LooseInput {
        return { t: 'block_input', name }
    }

    value(value: any): Input {
        return { t: 'value', value }
    }

    /*
       Start using a loose input in a term (probably called from .append)
        - Convert LooseInput into Input
        - Wrap values as ValueInput objects.
        - Give IDs as need to any terms used as local_inputs.
    */
    private useInput(input: LooseInput): Input {
        if (!input || !input.t)
            return { t: 'value', value: input };

        if (input.t === 'created_term') {
            const term = input.term;

            // About to use this term, make sure it has an assigned ID.
            if (!term.id)
                term.id = this.nextTermId.take();

            return { t: 'local_input', id: term.id };
        }

        if (input.t === 'block_input' || input.t === 'value' || input.t === 'local_input')
            return input;

        return { t: 'value', value: input };
    }

    comment(s: string) {
        this.queuedComment = s;
    }

    append(f: string, looseInputs: LooseInput[], opts: { id?: number, comment?: string } = {}): CreatedTerm {
        const inputs: Input[] = looseInputs.map(input => this.useInput(input));

        let comment = opts.comment;

        if (!comment && this.queuedComment) {
            comment = this.queuedComment;
            this.queuedComment = null;
        }

        const term = { f, inputs, id: opts.id, comment };
        this.terms.push(term);
        return { t: 'created_term', term };
    }

    appendInline(block: Block) {
        // TODO: remap inputs & outputs.
        for (const term of block.terms)
            this.append(term.f, term.inputs);
    }

    /*
      Fetch the static value associated with this input. (if any)
    */
    getStaticValue(input: Input) {
        if (input.t === 'value')
            return input.value;

        throw new Error("can't getStaticValue, input is dynamic: " + JSON.stringify(input));
    }

    str(options: { omitHeader?: boolean } = {}) {
        return blockToString(this, options);
    }

    // Builder functions - append a term with that function.

    call_mount_point(...ins) { return this.append('call_mount_point', ins) }
    call_mount_point2(...ins) { return this.append('call_mount_point2', ins) }
    run_query_with_provider(...ins) { return this.append('run_query_with_provider', ins) }
    send_to(...ins) { return this.append('send_to', ins) }
    output_done(...ins) { return this.append('output_done', ins) }
    join_streams(...ins) { return this.append('join_streams', ins) }
    get_index(...ins) { return this.append('get_index', ins) }
    new_stream(...ins) { return this.append('new_stream', ins) }
    new_empty_stream(...ins) { return this.append('new_empty_stream', ins) }
    put_error(...ins) { return this.append('put_error', ins) }
    close_stream(...ins) { return this.append('close_stream', ins) }
    step_input(...ins) { return this.append('step_input', ins) }
    step_output(...ins) { return this.append('step_output', ins) }
    step_with_verb(...ins) { return this.append('step_with_verb', ins) }
    step_with_input(...ins) { return this.append('step_with_input', ins) }
    step_with_output(...ins) { return this.append('step_with_output', ins) }
    step_without_attr(...ins) { return this.append('step_without_attr', ins) }
}

export class StackFrame {
    block: Block
    inputs: { [key:string]: any }
    locals = new Map<number, any>()

    constructor(block: Block, inputs: { [key:string]: any }) {
        this.block = block;
        this.inputs = inputs;
    }

    resolve(input: Input) {
        switch (input.t) {
        case 'value':
            return input.value;
        case 'block_input':
            if (this.inputs[input.name] === undefined)
                throw new Error("named input not found: " + input.name);
            return this.inputs[input.name];
        case 'local_input':
            return this.locals.get(input.id);
        default:
            throw new Error("failed to resolve input type: " + (input as any).t);
        }
    }

    run() {
        const block = this.block;

        for (let termIndex=0; termIndex < block.terms.length; termIndex++) {
            const term = block.terms[termIndex];
            const inputs = term.inputs.map(input => this.resolve(input));
            const func = builtinFunctions[term.f];
            const result = func.apply(null, inputs);
            if (term.id)
                this.locals.set(term.id, result);
        }
    }
}

export function executeBlock(block: Block, inputs: { [key:string]: any }) {
    if (!block)
        throw new Error("block is missing");

    const frame = new StackFrame(block, inputs);
    frame.run();
}

export class AstModification {
    beforeCallPoint?: (source: Block, copy: Block, callTerm: Term, target: MountPoint) => void
}

export function runAstModification(graph: Graph, source: Block, mod: AstModification): Block {
    const copy = new Block();
    copy.nextTermId.copyFrom(source.nextTermId);

    for (const term of source.terms) {

        if (mod.beforeCallPoint && term.f === 'call_mount_point') {
            const ref = source.getStaticValue(term.inputs[0]);
            const point = graph.getMountPoint(ref);
            if (!point)
                throw new Error("Mount point not found: " + JSON.stringify(ref));
            mod.beforeCallPoint(source, copy, term, point);
        }

        copy.append(term.f, term.inputs, term);
    }

    return copy;
}
// next:
//   more code using call_mount_point2
