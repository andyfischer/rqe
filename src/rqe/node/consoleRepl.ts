
import * as Repl from 'repl'
import * as Path from 'path'
import * as os from 'os'

import { GraphLike, toQuery, Query } from '../graph'
import { getCompletions } from '../repl/Completer'
import { ConsoleFormatter } from '../repl/ConsoleFormatter'
import { gracefulExit } from './ProcessExit'
import { Stream } from '../Stream'

export interface ReplOptions {
    prompt?: string
    handleQuery?: (query: Query) => Stream
}

export function startConsoleRepl(graph: GraphLike, opts: ReplOptions = {}) {

    let enableConsoleOverwrite = true;
    let repl;
    let prompt = opts.prompt || 'rqe~ ';

    let consoleLog = console.log;

    const formatter = new ConsoleFormatter({
        graph,
        log: consoleLog,
        prompt,
        printPrompt: () => repl.displayPrompt(),
        setPrompt: (s) => repl.setPrompt(s),
    });

    if (enableConsoleOverwrite) {
        console.log = (...args) => {
            formatter.preemptiveLog.apply(formatter, args);
        }
    }

    repl = Repl.start({
        prompt,
        eval: line => {
            if (!line || line.trim() === '') {
                formatter.touch();
                return;
            }

            let stream: Stream;

            if (opts.handleQuery) {
                const query = toQuery(line);
                stream = opts.handleQuery(query);
            } else {
                stream = graph.query(line);
            }

            const task = formatter.newTask();
            stream.sendTo(task.incoming);
        },
        completer(line) {
            //console.log('completer looking at: ', line);
            const completions = getCompletions(graph, line);
            //console.log('completions: ', completions);
            return [completions, line];
        }
    });

    try {
        repl.setupHistory(Path.join(os.homedir(), '.rqe_history'), () => {});
    } catch (e) { }

    repl.on('exit', () => {
        gracefulExit(0);
    });

    return repl;
}
