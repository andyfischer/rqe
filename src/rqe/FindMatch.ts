
import { MountPoint } from './MountPoint'
import { QueryStep, toQueryTuple, QueryStepLike,
    withoutAttr, withoutStar, withAttrs, tupleGetStringValue,
    tupleHas, tupleHasStar } from './Query'
import { explainWhyQueryFails } from './Explain'
import { Graph } from './Graph'
import { Stream } from './Stream'
import { Step } from './Step'
import { QueryTagEntry, tupleGetTag, attrsToItem, queryTupleToString } from './Query'
import { get, has } from './Item'
import { tvalEquals } from './TaggedValue'
import { WarnOnMultipleMatches, VerboseTraceFindMatch } from './config'

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

export type AttrMatch = AttrExactMatch | AttrPartiallyFilled | AttrOverprovided;

export interface QueryMountMatch {
    attrs: Map<string, AttrMatch>
}

export interface PointMatch {
    point: MountPoint
    match: QueryMountMatch
}

export interface MountPointRef {
    moduleId: string
    pointId: number
}

export function getQueryMountMatch(tuple: QueryStep, point: MountPoint): QueryMountMatch {
    const attrMatches = new Map();

    // Check each attribute on the tuple.
    for (const [ attr, queryAttr ] of Object.entries(tuple.attrs)) {
        if (!attr)
            continue;

        const queryHasKnownValue = queryAttr.value.t !== 'no_value' && queryAttr.value.t !== 'abstract';
        const queryWillHaveValue = queryAttr.value.t !== 'no_value' && !queryAttr.identifier;
        const pointAttr = point.attrs[attr];

        if (!pointAttr) {
            // Mount does not provide this attribute.
            if (VerboseTraceFindMatch) {
                console.slog(`  match failed, rule does not have ${attr}:`, point.spec);
            }
            return null;
        }

        if (pointAttr.requiresValue && !queryWillHaveValue) {
            // Mount requires a value and the query doesn't provide.
            if (VerboseTraceFindMatch) {
                console.slog(`  match failed, rule requires value for ${attr}:`, point.spec);
            }
            return null;
        }

        if (pointAttr.specificValue) {
            if (queryHasKnownValue) {
                if (tvalEquals(pointAttr.specificValue, queryAttr.value)) {
                    attrMatches.set(attr, {
                        t: 'exact'
                    });
                    continue;
                } else {
                    // Value not equal
                    if (VerboseTraceFindMatch) {
                        console.slog(`  match failed, unequal known value for ${attr}:`, point.spec);
                    }
                    return null;
                }
            }

            if (queryWillHaveValue) {
                console.warn(`warning: can't yet support a match that is conditional on value (${attr})`);
                if (VerboseTraceFindMatch) {
                    console.slog(`  match failed, dynamic value for ${attr}:`, point.spec);
                }
                return null;
            }

            return null;
        }

        if (queryWillHaveValue) {
            // Query provides a value and the mount does not, this will overprovide data
            // and the results will need to be filtered.
            attrMatches.set(attr, {
                t: 'attr_overprovided'
            });
        } else {
            // Query provides a value and the mount accepts a value.
            attrMatches.set(attr, {
                t: 'exact'
            });
        }
    }

    // Double check each attr on the mount to see if we missed anything required.
    for (const [ attr, config ] of Object.entries(point.attrs)) {
        if (config.required && !attrMatches.has(attr)) {
            // Mount requires this attribute.
            if (VerboseTraceFindMatch) {
                console.slog(`  match failed, rule requires ${attr}:`, tuple);
            }
            return null;
        }
    }

    if (VerboseTraceFindMatch) {
        console.slog(`  match success for:`, tuple);
    }

    return {
        attrs: attrMatches
    }
}

export function* findEveryPointMatch(points: Iterable<MountPoint>, tuple: QueryStep): IterableIterator<PointMatch> {

    if (VerboseTraceFindMatch)
        console.slog('FindMatch searching for: ', tuple);

    for (const point of points) {
        const match = getQueryMountMatch(tuple, point);

        if (match)
            yield { point, match };
    }
}

export function findBestPointMatch(graph: Graph, tupleLike: QueryStepLike): PointMatch | null {
    const tuple = toQueryTuple(tupleLike);

    let matches: {point: MountPoint, match: QueryMountMatch }[] = [];

    for (const match of findEveryPointMatch(graph.everyMountPoint(), tuple)) {
        matches.push(match);
    }

    if (matches.length === 0)
        return null;

    // Maybe do something better here
    if (matches.length > 1) {
        if (WarnOnMultipleMatches)
            console.warn("warning: multiple matches found for: " + queryTupleToString(tuple));
    }

    const match = matches[0];

    return match;
}

function callMountPoint(step: Step, match: PointMatch, tuple: QueryStep, input: Stream, output: Stream) {
    const point = match.point;

    const overprovidedTags: QueryTagEntry[] = [];
    const tupleItem = attrsToItem(tuple.attrs);

    for (const [ attr, info ] of match.match.attrs.entries()) {
        if (info.t === 'attr_overprovided') {
            overprovidedTags.push({ attr, tag: tupleGetTag(tuple, attr)});
        }
    }

    // Add a transformer to fix the outgoing output.
    let mountPointOutput = output;

    if (overprovidedTags.length > 0) {
        mountPointOutput = new Stream();

        mountPointOutput.transform(output, item => {

            // Maybe drop an overprovided item according to tuple.
            for (const entry of overprovidedTags) {
                switch (entry.tag.value.t) {
                case 'str_value':
                    if (has(item, entry.attr) && (get(item, entry.attr)+'') !== entry.tag.value.str) {
                        // console.log('dropping overprovided - value didn\'t match for ' + tag.attr);
                        return [];
                    }
                }
            }

            // Make sure the outgoing item includes all values from the tuple.
            const fixed = { ...tupleItem };

            for (const [ attr, value ] of Object.entries(item)) {
                fixed[attr] = value;
            }

            return [fixed]
        });
    }

    step.callMountPoint(
        point.getRef(),
        tuple,
        input,
        mountPointOutput
    );
}

export function runTableSearch(step: Step, tuple: QueryStep, input: Stream, output: Stream) {

    if (tupleHas(tuple, 'from')) {
        runTableSearchUsingFrom(step, tuple, input, output);
        return;
    }

    const match = findBestPointMatch(step.graph, tuple);

    if (!match) {
        step.output.errorAndClose({
            errorType: 'no_table_found',
            query: tuple,
        });
        return;
    }

    callMountPoint(step, match, tuple, input, output);
}

function runTableSearchUsingFrom(step: Step, tuple: QueryStep, input: Stream, output: Stream) {
    const tableName = tupleGetStringValue(tuple, 'from');
    const point = step.graph.findTableByName(tableName);

    let remainingCommand = withoutAttr(tuple, 'from');

    if (!point) {
        step.output.errorAndClose({
            errorType: 'no_table_found',
            query: tuple,
        });
        return;
    }

    if (tupleHasStar(tuple)) {
        remainingCommand = withoutStar(remainingCommand);

        const missingAttrs = [];
        
        for (const attr of Object.keys(point.attrs)) {
            if (!tupleHas(tuple, attr))
                missingAttrs.push(attr);
        }

        remainingCommand = withAttrs(remainingCommand, missingAttrs);
    }

    const match = getQueryMountMatch({ t: 'step', verb: null, attrs: remainingCommand.attrs }, point);

    if (!match) {
        const { missingRequired, missingRequiredValue, extraAttrs } = explainWhyQueryFails(remainingCommand, point);

        if (missingRequired.length > 0) {
            step.output.errorAndClose({
                errorType: "MissingAttrs",
                message: "Missing required attr(s): " + missingRequired.join(','),
            });
        }

        if (missingRequiredValue.length > 0) {
            step.output.errorAndClose({
                errorType: "MissingValue",
                message: "Missing value for attr(s): " + missingRequiredValue.join(','),
            });
        }

        if (extraAttrs.length > 0) {
            step.output.errorAndClose({
                errorType: "ExtraAttrs",
                message: "Table doesn't provide attr(s): " + extraAttrs.join(','),
            });
        }

        output.done();
        return;
    }

    tuple = withoutAttr(tuple, 'from');

    callMountPoint(step, { point, match }, tuple, input, output);
}
