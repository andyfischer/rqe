
import { Graph } from '../Graph'
import { Stream } from '../Stream'
import { Step } from '../Step'
import { prepareTableSearch } from '../FindMatch'
import { shallowCopy } from '../Item'
import { QueryTuple, QueryTag, tagsToItem } from '../Query'
import { Block } from '../Block'
import { PrepareParams } from '../Planning'

function prepare({graph, later, tuple}: PrepareParams) {
    const { provider_id, query } = tagsToItem(tuple.tags);
    const input = later.namedInput('step_input');
    const output = later.namedInput('step_output');

    if (!query) {
        later.put_error(output, { errorType: 'missing_parameter', message: 'missing "query"' });
        later.close_stream(output);
        return;
    }

    const run = later.run_query_with_provider(later.namedInput('graph'), provider_id, query, input);
    later.send_to(run, output);
}

export const run_query_with_provider = {
    prepare,
    runUsingBlock: true,
}
