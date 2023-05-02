
import { timedOut } from '../utils/timedOut'
import { Expect } from './Expect'
import { StringIDSource } from '../utils/IDSource'
import { ErrorItem } from '../Errors'
import { MultiMap } from '../utils/MultiMap'
import { green, red, yellow, black, grey, greenBg, redBg, yellowBg } from '../repl/AnsiColors'
import { TestCases } from './TestState'

export type TestCallback = (graph: any) => void | Promise<void>

export interface TestCase {
    id?: string
    description: string
    callback: TestCallback
    definedAt?: string
    enabled: boolean
}

export interface TestError {
    failure_id?: string
    error_type: string
    message?: string
    stack?: any
    run_id: string
    scenario_id: string
}

export interface TestResult {
    run_id: string
    testCase: TestCase
    ranScenarios: Scenario[]
    errors: TestError[]
    coincidenceErrors: ErrorItem[]
}

type Scenario = { t: 'default_scenario' } | { t: 'enable_alt_impl', name: string }

function scenarioToId(scenario: Scenario) {
    switch (scenario.t) {
    case 'default_scenario':
        return 'default';
    case 'enable_alt_impl':
        return 'enable_alt_impl_' + scenario.name;
    }
}

export class TestFramework {

    //globalGraph: Graph
    testTimeoutMs = 5000
    testRunId = new StringIDSource()
    scenarios: Scenario[] = [{ t: 'default_scenario' }]

    constructor(/*globalGraph?: Graph*/) {
        //this.globalGraph = globalGraph;
    }

    addScenario(scenario: Scenario) {
        this.scenarios.push(scenario);
    }

    async runSingleCaseAndScenario(testCase: TestCase, scenario: Scenario, result: TestResult, preexistingFailureIds) {

        const graph = {};
        //const graph = new Graph();
        //graph.silentFailures = true;
        const run_id = result.run_id;
        const scenario_id = scenarioToId(scenario);

        /*
        switch (scenario.t) {
        case 'enable_alt_impl':
            graph.setAlternateImplEnabled(scenario.name, true);
            break;
        }
        */

        let promise;

        try {
            promise = Promise.resolve(testCase.callback(graph));
        } catch (err) {
            const error_type = err['error_type'] || 'unhandled_exception';
            result.errors.push({ 
                ...err,
                stack: err.stack,
                message: err.message,
                error_type,
                run_id,
                scenario_id,
            });
            promise = Promise.resolve(null);
        }

        promise = promise.catch(err => {
            const error_type = err['error_type'] || 'unhandled_rejection';
            result.errors.push({
                ...err,
                stack: err.stack,
                message: err.message,
                error_type,
                run_id,
                scenario_id,
            });
        });

        if (await timedOut(promise, this.testTimeoutMs)) {
            result.errors.push({ error_type: 'timed_out', run_id, scenario_id });
            return;
        }

        /*
        if (graph.failureTable)
            for (const fail of graph.failureTable.list())
                result.errors.push({ error_type: 'fail', run_id, scenario_id, ...fail });

        // Check for coincidence errors
        if (this.globalGraph) {
            for (const globalFail of this.globalGraph.builtins.failures().scan()) {
                if (!preexistingFailureIds.has(globalFail.failure_id))
                    result.coincidenceErrors.push(globalFail);
            }
        }
        */
    }

    async runSingleCase(testCase: TestCase) {
        if (!testCase.enabled)
            return;

        const run_id = this.testRunId.take();
        let preexistingFailureIds = [];

        /*
        if (this.globalGraph)
            this.globalGraph.builtins.failures().columnAsSet('failure_id');
            */

        const result: TestResult = {
            run_id,
            testCase,
            ranScenarios: this.scenarios,
            errors: [],
            coincidenceErrors: [],
        };

        for (const scenario of this.scenarios) {
            await this.runSingleCaseAndScenario(testCase, scenario, result, preexistingFailureIds);
        }

        return result;
    }

    runTestCases(cases: TestCase[]): Promise<TestResult[]> {
        return Promise.all(cases.map(testCase => this.runSingleCase(testCase)));
    }

    /*
    runAll(graph: Graph): Promise<TestResult[]> {
        const everyCase: TestCase[] = graph.builtins.testCases().listWhere({enabled:true});
        return this.runTestCases(everyCase);
    }*/
}

interface OverallSummary {
    passedCount: number
    failedCount: number
    totalCount: number
    hasDisplayedCoincidenceError: Set<any>
}

export function summarizeOneTestResult(testResult: TestResult, summary: OverallSummary, log: (s?: any) => void) {
    const passed = testResult.errors.length === 0;
    const errorsByScenario = new MultiMap();

    for (const error of testResult.errors) {
        if (error.scenario_id)
            errorsByScenario.add(error.scenario_id, error);
    }

    const errorsOnCertainScenario = !passed && (errorsByScenario.valueCount() < testResult.ranScenarios.length);

    // Update summary
    summary.totalCount++;
    if (passed)
        summary.passedCount++;
    else
        summary.failedCount++;

    let leftSideLabel;

    if (passed) {
        leftSideLabel = black(greenBg(' PASS '));
    } else {
        leftSideLabel = black(redBg(' FAIL '))
    }

    if (errorsOnCertainScenario) {
        leftSideLabel = black(yellowBg(' MIX  '))
    }

    let definedAtSection = '';
    if (testResult.testCase.definedAt)
        definedAtSection = ` - ${grey(testResult.testCase.definedAt)}`

    log(`${leftSideLabel} ${testResult.testCase.description}${definedAtSection}`);

    if (errorsOnCertainScenario) {
        for (const scenario of testResult.ranScenarios) {
            let label = errorsByScenario.has(scenarioToId(scenario)) ? black(redBg(' FAIL ')) : black(greenBg(' PASS '));
            log(`  ${label} during scenario: ${scenarioToId(scenario)}`);
        }
    }

    for (const error of testResult.errors) {
        log(error)
        summary.hasDisplayedCoincidenceError.add(error.failure_id);
        // log(`${yellow('Error: ' + error.message) + '\n' + error.stack}`)
    }
}

export function summarizeTestResults(results: TestResult[], log: (s?: any) => void) {

    const summary: OverallSummary = {
        passedCount: 0,
        failedCount: 0,
        totalCount: 0,
        hasDisplayedCoincidenceError: new Set(),
    }

    for (const testResult of results) {
        summarizeOneTestResult(testResult, summary, log);
    }

    log();

    let coincidenceErrorCount = 0;

    for (const testResult of results) {
        for (const error of testResult.coincidenceErrors) {
            if (summary.hasDisplayedCoincidenceError.has(error.failureId))
                continue;

            summary.hasDisplayedCoincidenceError.add(error.failureId);
            coincidenceErrorCount++;

            log(`${yellow('Error: ' + error.errorMessage) + '\n' + error.stack}`)
        }
    }

    if (coincidenceErrorCount > 0)
        log();

    let countSections = [];
    if (summary.failedCount > 0) {
        countSections.push(red(`${summary.failedCount} failed`));
    }

    countSections.push(green(`${summary.passedCount} passed`));
    countSections.push(`${summary.totalCount} total`);

    log(`Tests: ${countSections.join(', ')}`);
    if (coincidenceErrorCount > 0)
        log(`${yellow(coincidenceErrorCount + " error(s) occurred during tests")}`);

    log();
}

export function summarizeTestResultsToString(results: TestResult[]) {
    let lines = [];
    summarizeTestResults(results, str => {
        if (str === undefined)
            str = '';
        lines.push(JSON.stringify(str));
    });
    return lines.join('\n');
}

export function summarizeTestResultsToConsole(results: TestResult[]) {
    summarizeTestResults(results, console.log);
}

function getFunctionDefinedAt(stack: any) {
    let definedAt = stack.toString().split('\n')[2];

    definedAt = definedAt.slice(definedAt.indexOf('(') + 1, definedAt.indexOf(')'));
    let lineNumber = definedAt.slice(definedAt.indexOf(':'), definedAt.length);
    lineNumber = ':' + lineNumber.split(':')[1];
    definedAt = definedAt.slice(0, definedAt.indexOf(':')) + lineNumber;

    return definedAt;
}

export function it(description: string, callback: TestCallback) {
    const stack = (new Error()).stack;

    TestCases.insert({
        description,
        callback,
        definedAt: getFunctionDefinedAt(stack),
        enabled: true
    });
}

export function xit(description: string, callback: TestCallback) {
    const stack = (new Error()).stack;

    TestCases.insert({
        description,
        callback,
        definedAt: getFunctionDefinedAt(stack),
        enabled: false
    });
}

export function expect(value) {
    return new Expect(value);
}

export function describe(description: string, callback: () => void) {
    // todo - maybe do more stuff here
    callback();
}
