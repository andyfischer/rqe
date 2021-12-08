
import { Query, QueryStep, QueryTag } from './Query'

export type DynamicValues = { [attr: string]: any }


function shallowCopyTag(tag: QueryTag): QueryTag {
    return { ...tag }
}

function shallowCopyTuple(tuple: QueryStep): QueryStep {
    return {
        t: tuple.t,
        verb: tuple.verb,
        tags: tuple.tags.concat(),
    }
}

function shallowCopyQuery(query: Query): Query {
    return {
        t: 'pipedQuery',
        steps: query.steps.concat(),
    }
}

export function* rewriteQueryTags(ref: { query: Query }): IterableIterator<[ QueryTag, () => QueryTag ]> {
    
    let copiedQuery = false;

    for (let stepIndex=0; stepIndex < ref.query.steps.length; stepIndex++) {
        let step = ref.query.steps[stepIndex];
        let copiedTuple = false;

        for (let tagIndex=0; tagIndex < step.tags.length; tagIndex++) {
            let tag = step.tags[tagIndex];

            function getWritableTag(): QueryTag {
                if (!copiedQuery) {
                    ref.query = shallowCopyQuery(ref.query);
                    copiedQuery = true;
                }

                if (!copiedTuple) {
                    step = shallowCopyTuple(step);
                    ref.query.steps[stepIndex] = step;
                    copiedTuple = true;
                }

                const newTag = shallowCopyTag(tag);
                step.tags[tagIndex] = newTag;
                return newTag;
            }

            yield [ tag, getWritableTag ];
        }
    }
}

export default class PreparedQuery {
    query: Query;

    constructor(query: Query) {
        this.query = query;
    }

    withValues(values: DynamicValues): Query {
        const ref = { query: this.query }
        for (const [ tag, getWritableTag ] of rewriteQueryTags(ref)) {
            if (values[tag.attr]) {
                getWritableTag().value = { t: 'strValue', str: values[tag.attr] }
            }
        }
        return ref.query;
    }
}
