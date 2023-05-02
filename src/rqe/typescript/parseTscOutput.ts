
import { compileSchema, Table } from '../table'

export type ParsedOutputItem = ErrorOutput;

interface ErrorOutput {
  t: 'error';
  filename: string;
  lineNumber: string;
  columnNumber: string;
  errorCode: string;
  errorMessage: string;
}

/*
  Parse the console output from TSC.

  Example output:

    src/query/QueryPlan.ts:545:78 - error TS2339: Property 'executionType' does not exist on type 'Task'.

    545     executePlan(plan, step.parameters, Stream.newEmptyStream(), output, step.executionType);
*/

export function parseTscOutputItems(output: string): ParsedOutputItem[] {
  const parsedOutput: ParsedOutputItem[] = [];

  const lines = output.split('\n');
  lines.forEach((line) => {
      line = line.trim();
    const errorMatch = line.match(
      /^(.*?):(\d+):(\d+)\s-\serror\s(\w+):\s(.*)$/
    );
    if (errorMatch) {
      const [, filename, lineNumber, columnNumber, errorCode, errorMessage] = errorMatch;
      parsedOutput.push({
        t: 'error',
        filename,
        lineNumber,
        columnNumber,
        errorCode,
        errorMessage,
      });
    }
  });

  return parsedOutput;
}

export function parseTscOutput(output: string): Table<ParsedOutputItem> {
    const table = compileSchema({
        name: 'ParsedTscOutput',
        funcs: [
            'list(filename)'
        ]
    }).createTable();

    for (const item of parseTscOutputItems(output))
        table.insert(item);

    return table;
}
