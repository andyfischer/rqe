
import { Step } from './Step'
import { MountPoint } from './MountPoint'
import { QueryTuple, tupleHas, tupleHasValue } from './Query'

export function explainWhyQueryFails(tuple: QueryTuple, table: MountPoint) {
    const missingRequired: string[] = [];
    const missingRequiredValue: string[] = [];
    const extraAttrs: string[] = [];

    for (const tag of tuple.tags) {
        if (!tag.attr)
            continue;

        if (!table.has(tag.attr)) {
            extraAttrs.push(tag.attr);
        }
    }

    for (const [attr, attrConfig] of this.attrs.entries()) {
        if (attrConfig.required && !tupleHas(tuple, attr)) {
            missingRequired.push(attr);
            continue;
        }

        if (attrConfig.withValue && tupleHasValue(tuple, attr)) {
            missingRequiredValue.push(attr);
            continue;
        }
    }

    return { missingRequired, missingRequiredValue, extraAttrs }
}

