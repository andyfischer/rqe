
import { QueryLike, LoosePipedQuery, QueryStepLike, Query, QueryStep,
    prepareLooseQueryStep, toQuery } from './Query'

export function add(...queries: QueryLike[]): Query {

    let combinedSteps = [];

    if (queries.length === 0) {
        return {
            t: 'pipedQuery',
            steps: []
        }
    }

    for (const queryLike of queries) {
        combinedSteps = combinedSteps.concat(toQuery(queryLike).steps);
    }

    return {
        t: 'pipedQuery',
        steps: combinedSteps
    }
}

export function where(looseLhs: QueryLike, looseWhereCondition: QueryStepLike): Query {

    const lhs = toQuery(looseLhs);
    const where = prepareLooseQueryStep({}, looseWhereCondition);

    return {
        t: 'pipedQuery',
        steps: lhs.steps.concat({
            ...where,
            verb: 'where',
        })
    }
}
