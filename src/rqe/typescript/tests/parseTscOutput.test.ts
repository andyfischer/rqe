import { parseTscOutputItems, ParsedOutputItem } from '../parseTscOutput';
import { it, expect } from '../../test';

it('should parse a single error correctly', () => {
  const output = `src/query/QueryPlan.ts:545:78 - error TS2339: Property 'executionType' does not exist on type 'Task'.
  
  545     executePlan(plan, step.parameters, Stream.newEmptyStream(), output, step.executionType);`;

  const expectedOutput: ParsedOutputItem[] = [
    {
      t: 'error',
      filename: 'src/query/QueryPlan.ts',
      lineNumber: '545',
      columnNumber: '78',
      errorCode: 'TS2339',
      errorMessage: "Property 'executionType' does not exist on type 'Task'.",
    },
  ];

  const parsedOutput = parseTscOutputItems(output);

  expect(parsedOutput).toEqual(expectedOutput);
});

it('should parse multiple errors correctly', () => {
  const output = `
    src/query/QueryPlan.ts:534:46 - error TS2339: Property 'context' does not exist on type 'Task'.

    534     const plan = createPlan(step.graph, step.context, tuple, { t: 'no_value' });
                                                   ~~~~~~~

    src/query/QueryPlan.ts:537:83 - error TS2339: Property 'executionType' does not exist on type 'Task'.

    537         dumpPlan({ plan, prefix: 'Runtime plan and execute:', executionType: step.executionType });
                                                                                        ~~~~~~~~~~~~~

    src/query/QueryPlan.ts:539:14 - error TS2339: Property 'executionType' does not exist on type 'Task'.

    539     if (step.executionType === 'schemaOnly') {
  `;

  const expectedOutput: ParsedOutputItem[] = [
    {
      t: 'error',
      filename: 'src/query/QueryPlan.ts',
      lineNumber: '534',
      columnNumber: '46',
      errorCode: 'TS2339',
      errorMessage: "Property 'context' does not exist on type 'Task'.",
    },
    {
      t: 'error',
      filename: 'src/query/QueryPlan.ts',
      lineNumber: '537',
      columnNumber: '83',
      errorCode: 'TS2339',
      errorMessage: "Property 'executionType' does not exist on type 'Task'.",
    },
    {
      t: 'error',
      filename: 'src/query/QueryPlan.ts',
      lineNumber: '539',
      columnNumber: '14',
      errorCode: 'TS2339',
      errorMessage: "Property 'executionType' does not exist on type 'Task'.",
    },
  ];

  const parsedOutput = parseTscOutputItems(output);

  expect(parsedOutput).toEqual(expectedOutput);
});
