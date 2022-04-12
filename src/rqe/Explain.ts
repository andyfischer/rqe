

import { MountPoint } from './MountPoint'
import { QueryStep, tupleHas, tupleHasValue } from './Query'

export function explainWhyQueryFails(tuple: QueryStep, table: MountPoint) {
    const missingRequired: string[] = [];
    const missingRequiredValue: string[] = [];
    const extraAttrs: string[] = [];

    for (const attr of Object.keys(tuple.attrs)) {
        if (!table.has(attr)) {
            extraAttrs.push(attr);
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

