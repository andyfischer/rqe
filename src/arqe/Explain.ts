
import Params from './Params'
import { MountPoint } from './Mounts'

export function explainWhyQueryFails(params: Params, table: MountPoint) {
    const missingRequired: string[] = [];
    const missingRequiredValue: string[] = [];
    const extraAttrs: string[] = [];

    for (const tag of params.tags) {
        if (!tag.attr)
            continue;

        if (!table.has(tag.attr)) {
            extraAttrs.push(tag.attr);
        }
    }

    for (const [attr, attrConfig] of this.attrs.entries()) {
        if (attrConfig.required && !params.has(attr)) {
            missingRequired.push(attr);
            continue;
        }

        if (attrConfig.withValue && params.hasValue(attr)) {
            missingRequiredValue.push(attr);
            continue;
        }
    }

    return { missingRequired, missingRequiredValue, extraAttrs }
}

