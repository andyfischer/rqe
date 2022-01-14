
import { Step } from '../Step'
import { Verb } from './_shared'

import { add } from './add'
import { count } from './count'
import { get } from './get'
import { join } from './join'
import { just } from './just'
import { limit } from './limit'
import { last } from './last'
import { need } from './need'
import { one } from './one'
import { rate } from './rate'
import { rename } from './rename'
import { reverse } from './reverse'
import { run_query_with_provider } from './run_query_with_provider'
import { save_to_csv } from './save_to_csv'
import { then } from './then'
import { trace } from './trace'
import { wait } from './wait'
import { where } from './where'
import { without } from './without'
import { value } from './value'

let _everyVerb: { [name: string]: Verb };

function init() {
    _everyVerb = {
        add,
        count,
        get,
        join,
        just,
        limit,
        last,
        need,
        one,
        save_to_csv,
        then,
        rate,
        rename,
        reverse,
        run_query_with_provider,
        trace,
        wait,
        where,
        without,
        value,
    }
}

export function everyVerb(): { [name: string]: any } {
    if (!_everyVerb)
        init();

    return _everyVerb;
}

export function getVerb(verb: string) {
    if (!_everyVerb)
        init();

    return _everyVerb[verb];
}

export function listEveryVerb() {
    if (!_everyVerb)
        init();

    return Object.keys(_everyVerb);
}
