
import { startConsoleRepl, ReplOptions } from './consoleRepl'
// import { SubprocessMount, ShellCommand, toShellCommand, setupSubprocessTable } from './SubprocessMount'
import { overrideProcessExit } from './ProcessExit'
import { parseCommandLineArgs } from './parseCommandLineArgs'
import { ConsoleFormatter } from '../repl/ConsoleFormatter'
// import { QueryLike } from '../query/Query'
import { Graph } from '../graph'
import { getGraph } from '../globalState'

export { startConsoleRepl } from './consoleRepl'

export interface StartOptions {
    // Called while setting up the graph
    setupGraph?(graph: Graph): void

    // Called once setup is done
    onReady?(graph: Graph): void | Promise<void>
    // runWhenReady?: QueryLike[]

    loadFiles?: string[]
    loadModules?: any[]
    // loadSubprocesses?: ShellCommand[]
    startRepl?: boolean | ReplOptions // API suggestion- maybe remove this, caller can use startConsoleRepl?
    terminal?: {
        title?: string
    }
    runFromStdin?: boolean
    standardCommandLineArgHandling?: boolean
    enableLoggingCategories?: string[]
}

/*
  Initialize the process global graph for a command-line application.

  This includes:
    - Adding standard tables (reading filesystem and etc)
    - Launching subprocesses (if configured)
*/

/*
export function setupCliGraph(options: StartOptions) {
    const graph = getGraph();

    require('./lib/fs');
    require('./lib/buffer');
    require('./lib/git');
    require('./lib/OptionalNodeInstall');
    require('./lib/ScratchDirs');
    require('./Shell');

    graph.enableLogging();
    for (const category of options.enableLoggingCategories || [])
        graph.logging.enable(category);

    graph.setupBrowse();

    if (options.setupGraph)
        options.setupGraph(graph);

    for (const filename of (options.loadFiles || [])) {
        //requireAndWatch(graph, filename);
        require(filename);
    }
    
    for (const module of (options.loadModules || [])) {
        throw new Error("loadModules is disabled");
    }

    setupSubprocessTable(graph);
    for (const subprocessCommand of (options.loadSubprocesses || [])) {
        const subprocess = new SubprocessMount(graph, subprocessCommand);
        subprocess.start();
    }

    return graph;
}
*/

/*
 Start running this process as a command-line application.

 This does various process-wide things like:

   - Read command line options from process.argv.
   - Override process.exit for graceful shutdown.
*/

function optionsWithCommandLine(options: StartOptions) {
    const args = parseCommandLineArgs();

    for (const tag of args.tags){
        if (tag.attr === 'subprocess') {
                    throw new Error("fix: subprocess")
                    /*
            options.loadSubprocesses = options.loadSubprocesses || [];
            options.loadSubprocesses.push(toShellCommand(flag.value));
            */
        }

        if (tag.attr === 'enable-logging') {
            options.enableLoggingCategories = options.enableLoggingCategories || [];
            options.enableLoggingCategories.push(tag.value as string);
        }

        if (tag.attr === 'stdin') {
            options.runFromStdin = true;
        }
    }

    return options;
}

function optionsWithDefaults(options: StartOptions) {
    if (options.runFromStdin && options.startRepl === undefined)
        options.startRepl = false;

    if (options.startRepl === undefined)
        options.startRepl = true;

    return options;
}

function runFromStdin(graph: Graph) {
    const formatter = new ConsoleFormatter({ graph });

    process.stdin.on('data', chunk => {
        let query = chunk.toString();
        if (query[query.length -1] === '\n')
            query = query.slice(0, query.length - 1);

        graph.query(query).sendTo(formatter.newTask().incoming);
    });
}

function setTerminalTitle(title) {
  process.stdout.write(
    String.fromCharCode(27) + "]0;" + title + String.fromCharCode(7)
  );
}

export async function runCommandLineProcess(options: StartOptions = {}) {

    require('source-map-support').install();

    try {
        overrideProcessExit();

        // console.log('process.argv = ', process.argv);
        options = optionsWithCommandLine(options);
        options = optionsWithDefaults(options);

        const graph = getGraph();
        //setupCliGraph(options);

        if (options.terminal?.title) {
            setTerminalTitle(options.terminal.title);
        }

        if (options.onReady) {
            await options.onReady(graph);
        }

        /*
        if (options.runWhenReady) {
            const formatter = new ConsoleFormatter({ graph });

            for (const query of options.runWhenReady) {
                graph.query(query).sendTo(formatter.newTask().incoming);
            }
        }
        */

        if (options.startRepl) {
            const replOptions = (options.startRepl && typeof options.startRepl === 'object') ? options.startRepl : {};
            startConsoleRepl(graph, replOptions);
        }

        if (options.runFromStdin) {
            runFromStdin(graph);
        }

        return graph;
    } catch (err) {
        process.exitCode = -1;
        console.error(err.stack || err);
    }
}

if (require.main === module) {
    runCommandLineProcess({
        standardCommandLineArgHandling: false
    });
}
