


import { Stream, joinStreams } from '../Stream'
import { Step } from '../Step'
import { prepareTableSearch } from '../PlannedQuery'
import { shallowCopy } from '../Item'
import { QueryTag, tagsToItem } from '../Query'
import { Block } from '../Block'

function prepare(step: Step, later: Block) {
    const { provider_id, query } = step.queryToItem();

    if (!query) {
        const output = later.step_output(later.namedInput('step'));
        later.put_error(output, { errorType: 'missing_parameter', message: 'missing "query"' });
        later.close_stream(output);
        return;
    }

    const run = later.run_query_with_provider(later.namedInput('graph'), provider_id, query, later.step_input(later.namedInput('step')));
    later.send_to(run, later.step_output(later.namedInput('step')));

    /*
    console.log('args.query', args.query)
    console.log('args.query', JSON.stringify(args.query))
    console.log(later.str());
    console.log('run', run);
    */
}

export const run_query_with_provider = {
    prepare,
    runUsingBlock: true,
}
