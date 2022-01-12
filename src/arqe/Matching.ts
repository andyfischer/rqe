
import { QueryTuple } from './Query'
import { MountPoint } from './MountPoint'

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
