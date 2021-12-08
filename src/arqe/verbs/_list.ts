
import Params from '../Params'
import { runTableSearch } from '../runQuery'

import add from './add'
import count from './count'
import join from './join'
import limit from './limit'
import last from './last'
import rate from './rate'
import rename from './rename'
import reverse from './reverse'
import save_to_csv from './save_to_csv'
import where from './where'
import value from './value'

let _everyVerb;

function init() {
    _everyVerb = {
        add,
        count,
        get: runTableSearch,
        put: runTableSearch,
        join,
        limit,
        last,
        save_to_csv,
        rate,
        rename,
        reverse,
        where,
        value,
    }
}

export function getVerbHandler(verb: string) {
    if (!_everyVerb)
        init();

    return _everyVerb[verb];
}

export function listEveryVerb() {
    if (!_everyVerb)
        init();

    return Object.keys(_everyVerb);
}
