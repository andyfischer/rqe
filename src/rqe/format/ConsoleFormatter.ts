
import { Stream, PipedData, SchemaItem } from '../Stream'
import { IDSource } from '../utils/IDSource'
import { Item } from '../Item'
import { ErrorItem } from '../Errors'
import { TableFormatState, newTableFormatState, formatItems, updateStateForItems,
    formatHeader, printItems } from './TableFormatter';
import { Graph } from '../Graph';
import { Table } from '../Table'
import { queryStepToString } from '../Query'

interface Task {
    id: string
    incoming: Stream
    buffer: Item[]
    flushTimer: any
    formatState: TableFormatState
}

interface Settings {
    graph?: Graph
    log?: (...items: any[]) => void
    printPrompt?: () => void
    prompt?: string
    setPrompt?: (s: string) => void
}

type MostRecentOutput = 'none' | 'log' | 'prompt' | 'submitted' | { t: 'dataWithHeader', header: string }

export class ConsoleFormatter {
    // expose a interface for incoming Streams
    // keep track of whether the prompt is visible
    // show in-progress tasks
    // use ansi redrawing

    // more details
    //
    // incoming rows will go into a timed holding cell as we prepare to format them.
    //
    // If there's any user input then flush what we have
    //
    // Support both ansi and no-ansi mode?

    graph: Graph
    nextTaskId = new IDSource();
    activeTasks = new Map();
    flushDelayMs = 1000;
    log: (...items: any[]) => void
    prompt: string
    mostRecentOutput: MostRecentOutput
    settings: Settings
    header: Item

    constructor(settings: Settings) {
        this.graph = settings.graph;
        this.log = settings.log || console.log;
        this.prompt = settings.prompt;
        this.settings = settings;
        this.mostRecentOutput = 'none';
    }

    newTask(): Task {
        const id = this.nextTaskId.take();
        const incoming = new Stream();
        this.mostRecentOutput = 'submitted';

        const task: Task  = {
            id,
            incoming,
            buffer: [],
            flushTimer: null,
            formatState: newTableFormatState(),
        };

        incoming.sendTo({
            receive: (msg: PipedData) => {
                switch (msg.t) {
                case 'schema':
                    task.formatState.schema = msg.item;

                    // check for (...console_format_options) on this schema
                    this.graph.query([{ attrs: { ...msg.item, console_format_options: null } }])
                    .sendTo({
                        receive: (msg) => {
                            switch (msg.t) {
                                case 'item':
                                    task.formatState.options = msg.item.console_format_options;
                                    break;
                            }
                        }
                    });
                    
                    break;
                case 'item':
                    task.buffer.push(msg.item);

                    if (!task.flushTimer)
                        task.flushTimer = setTimeout(() => this.flushTaskBuffer(task.id), this.flushDelayMs);

                    break;
                case 'error':
                    this.logError(msg.item);
                    break;
                case 'done':
                    this.finishTask(id);
                    break;
                }
            }
        });

        this.activeTasks.set(id, task);
        return task;
    }

    logError(error: ErrorItem) {
        if (error.errorType === 'no_table_found') {

            if (error.query)
                this.log(`error: No table found for query: ${queryStepToString(error.query)}`);
            else
                this.log(`error: No table found for query: ${JSON.stringify(error)}`);

            return;
        }

        if (error.errorType === 'verb_not_found') {
            this.log(`error: Verb not recognized: ${error.verb}`);
            return;
        }

        this.log(`error: ${error.errorType} ${error.message || ''} ${error.stack || ''}`);
    }

    printTable(table: Table) {
        const task = this.newTask();
        task.incoming.putTableItems(table);
        task.incoming.done();
    }

    touch() {
        this.flushAllTasks();
        this.printPrompt();
    }

    flushAllTasks() {
        for (const task of this.activeTasks.values()) {
            this.flushTaskBuffer(task.id);
        }
    }

    flushTaskBuffer(id: string) {
        if (!id)
            throw new Error("missing id");

        const task = this.activeTasks.get(id);
        if (!task) {
            console.warn('task not found? ', id);
            return;
        }

        if (task.flushTimer) {
            clearTimeout(task.flushTimer);
            task.flushTimer = null;
        }

        if (task.buffer.length === 0)
            return;

        const items = task.buffer;
        task.buffer = [];

        const formatted = formatItems(task.formatState, items);
        updateStateForItems(task.formatState, formatted);
        const header = formatHeader(task.formatState);

        const skipHeader = (this.mostRecentOutput as any).t === 'dataWithHeader'
            && (this.mostRecentOutput as any).header == header.key;

        const wasPrompt = this.mostRecentOutput === 'prompt';
        if (this.mostRecentOutput === 'prompt')
            this.log();

        if (!skipHeader)
            header.print(this.log);

        printItems(task.formatState, formatted, this.log);
        this.mostRecentOutput = { t: 'dataWithHeader', header: header.key };

        if (wasPrompt)
            this.printPrompt();
    }

    preemptiveLog(...args) {
        this.flushAllTasks();
        this.log.apply(null, args);

        if (this.mostRecentOutput === 'prompt') {
            this.mostRecentOutput = 'log';
            this.maybePrintPrompt();
        }
    }

    finishTask(id: string) {
        this.flushTaskBuffer(id);
        // this.log(`(task done ${id})`);
        this.activeTasks.delete(id);

        this.printPrompt();
    }
    
    printPrompt() {

        let prompt = this.prompt;
        
        const taskCount = this.activeTasks.size;
        if (taskCount == 1) {
            prompt = '1 task running~ ';
        } else if (taskCount > 1) {
            prompt = `${taskCount} tasks running~ `;
        }

        if (this.settings.printPrompt)
            this.settings.setPrompt(prompt);

        if (this.settings.printPrompt)
            this.settings.printPrompt();

        this.mostRecentOutput = 'prompt';
    }

    maybePrintPrompt() {
        if (this.mostRecentOutput === 'prompt')
            return;

        this.printPrompt();
    }
}
