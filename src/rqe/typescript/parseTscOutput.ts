import { compileSchema, Table } from '../table'

export type ParsedOutputItem = ErrorOutput;

interface ErrorOutput {
  t: 'error';
  filename: string;
  lineNumber: number;
  columnNumber: number;
  errorCode: string;
  errorMessage: string;
}

export function parseTscOutput(output: string): ParsedOutputItem[] {
  const parsedOutput: ParsedOutputItem[] = [];

  const lines = output.split('\n');
  for (let line of lines) {
    line = line.trim();
    if (!line || line == '')
        continue;

    // Parse a line that looks like:
    //
    // src/mail-server/ops/SimulatedActivity.ts(19,44): error TS2339: Property 'oneAttr' does not exist on type 'Stream<any>'.

    const errorMatch = line.match(
        /^([^(]+)\((\d+),(\d+)\):\s(error)\s(\w+)\:\s(.*)$/
    );

    if (errorMatch) {
      const [, filename, lineNumber, columnNumber, _, errorCode, errorMessage] = errorMatch;
      parsedOutput.push({
        t: 'error',
        filename,
        lineNumber: parseInt(lineNumber),
        columnNumber: parseInt(columnNumber),
        errorCode,
        errorMessage,
      });
    } else {
        console.warn('parseTscOutput unrecognized line: ', line)
    }
  }

  return parsedOutput;
}

/*
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
}*/
