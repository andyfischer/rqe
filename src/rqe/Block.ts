
import { callMountPoint, runQueryWithProvider } from './RunningQuery'
import { MountPoint } from './MountPoint'
import { MountPointRef } from './FindMatch'
import { Step } from './Step'
import { Stream, joinStreams, PipeReceiver, TransformFunc, AggregationFunc } from './Stream'
import { blockToString } from './Debug'
import { Query, QueryTuple, tagsToItem } from './Query'
import { Graph, QueryExecutionContext } from './Graph'
import { ErrorItem } from './Errors'
import { IDSourceNumber as IDSource } from './utils/IDSource'
import { Item } from './Item'
import { streamingTransform } from './Concurrency'

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
    call_mount_point: (graph: Graph, context: QueryExecutionContext, point: MountPointRef,
                       tuple: QueryTuple, input: Stream, output: Stream) => {
        callMountPoint(graph, context, point, tuple, input, output);
    },
    output_done: (step: Step) => {
        step.output.done();
    },
    join_streams: (count, output): PipeReceiver[] => {
        return joinStreams(count, output);
    },
    run_query_with_provider: (graph: Graph, providerId: string, query: Query, input: Stream) => {
        return runQueryWithProvider(graph, providerId, query, input);
    },
    transform(input: Stream, output: Stream, func: TransformFunc) { 
        input.transform(output, func);
    },
    streaming_transform(input: Stream, output: Stream, func: TransformFunc, options) { 
        streamingTransform(input, output, func, options);
    },
    aggregate(input: Stream, output: Stream, func: AggregationFunc) { 
        input.aggregate(output, func);
    },
    get_index: (list, index) => list[index],
    new_stream: () => new Stream(),
    new_empty_stream: () => Stream.newEmptyStream(),
    put: (stream: Stream, item: Item) => {
        stream.put(item);
    },
    put_error: (stream: Stream, error: ErrorItem) => {
        stream.putError(error);
    },
    close_stream: (stream: Stream) => {
        if (!stream.done)
            throw new Error("not a stream? " + JSON.stringify(stream));
        stream.done();
    },
    step_input: (step: Step) => { return step.input; },
    step_output: (step) => { return step.output; },
    step_without_attr: (step: Step, attr: string) => step.dropAttr(attr),
    step_with_input: (step: Step, input: Stream) => step.withInput(input),
    step_with_output: (step: Step, output: Stream) => step.withOutput(output),
    send_to: (stream: Stream, output: Stream) => stream.sendTo(output),
    planned_put: () => {},
    planned_send_to: () => {},
}

const builtinsDuringSchemaPlanning = {
    ...builtinFunctions,
    call_mount_point: (graph: Graph, context: QueryExecutionContext, point: MountPointRef, tuple: QueryTuple,
                       input: Stream, output: Stream) => {
        output.receive({t: 'item', item: tagsToItem(tuple.tags)});
        output.receive({t: 'done'});
    },
    planned_put: (output: Stream, schema: Item) => {
        output.receive({t: 'item', item: schema});
        output.receive({t: 'done'});
    },
    planned_send_to: builtinFunctions.send_to,
}

export class Block {
    terms: Term[] = []
    nextTermId = new IDSource()
    termsById = new Map<number, Term>()

    queuedComment: string

    namedInput(name: string): LooseInput {
        if (name === 'step')
            throw new Error("'step' input was removed");

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

        if (input.t === 'stream')
            throw new Error("don't use a stream as a fixed value");

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

    hasError() {
        for (const term of this.terms) {
            if (term.f === 'put_error')
                return true;
        }
        return false;
    }

    *errors() {
        for (const term of this.terms) {
            if (term.f === 'put_error')
                yield this.getStaticValue(term.inputs[1]) as ErrorItem;
        }
    }

    input() {
        return this.namedInput('step_input');
    }
    
    output() {
        return this.namedInput('step_output');
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

    errorAndClose(error: ErrorItem) {
        const output = this.output();
        this.put_error(output, error);
        this.close_stream(output);
    }

    // Builder functions - append a term with that function.

    call_mount_point(...ins) {
        if (ins.length !== 6)
            throw new Error('call_mount_point expected 6 args');

        return this.append('call_mount_point', ins)
    }
    run_query_with_provider(...ins) { return this.append('run_query_with_provider', ins) }
    send_to(...ins) { return this.append('send_to', ins) }
    output_done(...ins) { return this.append('output_done', ins) }
    join_streams(...ins) {
        if (ins.length !== 2)
            throw new Error('join_streams expected 2 arguments');
        return this.append('join_streams', ins);
    }
    transform(input: LooseInput, output: LooseInput, func: TransformFunc) {
        return this.append('transform', [input, output, func])
    }
    streaming_transform(...ins) { return this.append('streaming_transform', ins) }
    aggregate(input: LooseInput, output: LooseInput, func: AggregationFunc) {
        return this.append('aggregate', [input, output, func])
    }
    get_index(...ins) { return this.append('get_index', ins) }
    new_stream(...ins) { return this.append('new_stream', ins) }
    new_empty_stream(...ins) { return this.append('new_empty_stream', ins) }
    put(...ins) { return this.append('put', ins) }
    put_error(...ins) { return this.append('put_error', ins) }
    close_stream(...ins) { return this.append('close_stream', ins) }
    step_input(...ins) { return this.append('step_input', ins) }
    step_output(...ins) { return this.append('step_output', ins) }
    step_with_input(...ins) { return this.append('step_with_input', ins) }
    step_with_output(...ins) { return this.append('step_with_output', ins) }
    step_without_attr(...ins) { return this.append('step_without_attr', ins) }
    planned_put(...ins) { return this.append('planned_put', ins) }
    planned_send_to(...ins) { return this.append('planned_send_to', ins) }
}

export class StackFrame {
    block: Block
    inputs: { [key:string]: any }
    locals = new Map<number, any>()
    schemaOnly: boolean

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
        const functionTable = this.schemaOnly ? builtinsDuringSchemaPlanning : builtinFunctions;

        for (let termIndex=0; termIndex < block.terms.length; termIndex++) {
            const term = block.terms[termIndex];
            const inputs = term.inputs.map(input => this.resolve(input));
            const func = functionTable[term.f];
            const result = func.apply(null, inputs);
            if (term.id)
                this.locals.set(term.id, result);
        }
    }
}

export function executeBlock(block: Block, inputs: { [ key:string ]: any }) {
    if (!block)
        throw new Error("block is missing");

    const frame = new StackFrame(block, inputs);
    frame.run();
}

export function executeBlockSchemaOnly(block: Block, inputs: { [ key:string ]: any }) {

    // console.log('runningSchemaOnly', block.str());

    const frame = new StackFrame(block, inputs);
    frame.schemaOnly = true;
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
            const ref = source.getStaticValue(term.inputs[2]);
            const point = graph.getMountPoint(ref);
            if (!point)
                throw new Error("Mount point not found: " + JSON.stringify(ref));
            mod.beforeCallPoint(source, copy, term, point);
        }

        copy.append(term.f, term.inputs, term);
    }

    return copy;
}
