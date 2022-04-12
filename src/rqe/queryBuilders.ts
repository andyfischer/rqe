
import { QueryLike, QueryStepLike, Query, toQueryTuple, toQuery } from './Query'

export function add(...queries: QueryLike[]): Query {

    let combinedSteps = [];

    if (queries.length === 0) {
        return {
            t: 'query',
            steps: []
        }
    }

    for (const queryLike of queries) {
        combinedSteps = combinedSteps.concat(toQuery(queryLike).steps);
    }

    return {
        t: 'query',
        steps: combinedSteps
    }
}

export function where(looseLhs: QueryLike, looseWhereCondition: QueryStepLike): Query {

    const lhs = toQuery(looseLhs);
    const where = toQueryTuple(looseWhereCondition);

    return {
        t: 'query',
        steps: lhs.steps.concat({
            ...where,
            verb: 'where',
        })
    }
}
