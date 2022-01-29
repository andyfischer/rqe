
import { MountPoint } from './MountPoint'
import { Query, QueryTuple, queryTupleToString, toQueryTuple, QueryTupleLike,
    queryHasAttr, withoutAttr, withoutStar, withAttrs, tupleGetStringValue,
    tupleHas, tupleHasStar } from './Query'
import { explainWhyQueryFails } from './Explain'
import { Block, executeBlockSchemaOnly, LooseInput, runAstModification } from './Block'
import { Graph } from './Graph'

// Exact match: the query specifies the exact same thing that
// the mount provides.
//
// This might be a universal attribute ("attribute") or it might
// be a specific value("attribute=x").

interface AttrExactMatch {
    t: 'exact'
}

// Partially filled / underprovided: The query asks for a universal
// match and the mount provides a specific subset.
//
// In this situation we might combine the results of multiple mounts,
// to deliver all the possible values that the query asks for.
interface AttrPartiallyFilled {
    t: 'attr_partially_filled'
}

// Overprovided: The query asks for a specific attribute value, and
// the provider gives a universal match.
//
// In this situation we'll probably use the mount, and then we'll
// add a "where" filter on the results.
interface AttrOverprovided {
    t: 'attr_overprovided'
}

export type AttrMatch = AttrExactMatch;

export interface QueryMountMatch {
    attrs: Map<string, AttrMatch>
}

export interface MountPointRef {
    moduleId: string
    pointId: number
}

export function getQueryMountMatch(tuple: QueryTuple, point: MountPoint): QueryMountMatch {
    const attrMatches = new Map();

    // Check each attribute on the tuple.
    for (const tag of tuple.tags) {
        if (!tag.attr)
            continue;

        const { attr } = tag;
        const querySpecifiesValue = tag.value.t !== 'no_value';
        const pointAttr = point.attrs.get(attr);

        if (!pointAttr) {
            // Mount does not provide this attribute.
            return null;
        }

        if (pointAttr.withValue && !querySpecifiesValue) {
            // Mount requires a value.
            return null;
        }

        if (pointAttr.withValue === false && querySpecifiesValue) {
            // Mount requires this attribute to have no value.
            return null;
        }

        if (querySpecifiesValue) {
            attrMatches.set(attr, {
                t: 'attr_overprovided'
            });
        } else {
            attrMatches.set(attr, {
                t: 'exact'
            });
        }
    }

    // Double check each attr on the mount to see if we missed anything required.
    for (const [ attr, config ] of point.attrs.entries()) {
        if (config.required && !attrMatches.has(attr)) {
            // Mount requires this attribute.
            return null;
        }
    }

    return {
        attrs: attrMatches
    }
}

export function pickBestMatch(matches: {point: MountPoint, match: QueryMountMatch }[]) {
    // Maybe do something better here
    return matches[0];
}

export function findBestPointMatch(graph: Graph, tupleLike: QueryTupleLike): {point: MountPoint, match: QueryMountMatch } | null {
    const tuple = toQueryTuple(tupleLike);

    let matches: {point: MountPoint, match: QueryMountMatch }[] = [];

    for (const point of graph.everyTable()) {
        const match = getQueryMountMatch(tuple, point);

        if (match)
            matches.push({point,match});
    }

    if (matches.length === 0)
        return null;

    const match = pickBestMatch(matches);
    return match;
}

export function prepareTableSearch(later: Block, graph: Graph, tuple: QueryTuple, input: LooseInput, output: LooseInput) {

    if (queryHasAttr(tuple, 'from')) {
        prepareTableSearchUsingFrom(later, graph, tuple, input, output);
        return;
    }

    const match = findBestPointMatch(graph, tuple);

    if (!match) {
        later.errorAndClose({
            errorType: 'no_table_found',
            query: tuple,
        });
        return;
    }

    const point = match.point;
    later.call_mount_point(
        later.namedInput('graph'),
        later.namedInput('step_context'),
        point.getRef(),
        tuple,
        input,
        output
    );
}

function prepareTableSearchUsingFrom(later: Block, graph: Graph, tuple: QueryTuple, input: LooseInput, output: LooseInput) {
    const tableName = tupleGetStringValue(tuple, 'from');
    const point = graph.findTableByName(tableName);

    let remainingCommand = withoutAttr(tuple, 'from');

    if (!point) {
        later.errorAndClose({
            errorType: 'no_table_found',
            query: tuple,
        });
        return;
    }

    if (tupleHasStar(tuple)) {
        remainingCommand = withoutStar(remainingCommand);

        const missingAttrs = [];
        
        for (const attr of point.attrs.keys()) {
            if (!tupleHas(tuple, attr))
                missingAttrs.push(attr);
        }

        remainingCommand = withAttrs(remainingCommand, missingAttrs);
    }

    const match = getQueryMountMatch({ t: 'tuple', verb: null, tags: remainingCommand.tags }, point);

    if (!match) {
        const { missingRequired, missingRequiredValue, extraAttrs } = explainWhyQueryFails(remainingCommand, point);

        if (missingRequired.length > 0) {
            later.errorAndClose({
                errorType: "MissingAttrs",
                message: "Missing required attr(s): " + missingRequired.join(','),
            });
        }

        if (missingRequiredValue.length > 0) {
            later.errorAndClose({
                errorType: "MissingValue",
                message: "Missing value for attr(s): " + missingRequiredValue.join(','),
            });
        }

        if (extraAttrs.length > 0) {
            later.errorAndClose({
                errorType: "ExtraAttrs",
                message: "Table doesn't provide attr(s): " + extraAttrs.join(','),
            });
        }

        later.output_done(later.namedInput('step_output'));
        return;
    }

    tuple = withoutAttr(tuple, 'from');

    const updatedStep = later.step_without_attr(later.namedInput('step'), 'from');

    later.call_mount_point(
        later.namedInput('graph'),
        later.namedInput('step_context'),
        point.getRef(),
        tuple,
        input,
        output
    );
}
