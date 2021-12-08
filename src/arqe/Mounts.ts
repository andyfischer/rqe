
import { QueryTag } from './Query'
import Params from './Params'
import { Setup } from './Setup'
import { Item } from './Item'
import { MountAttr, MountAttrMap } from './Setup'
import { BackpressureStop } from './Stream'

export type HandlerCallback = (input: Params) => void;
export type ItemCallback = (item: any, callInfo?: any) => void;



export class MountPoint {
    name: string

    attrs = new Map<string, MountAttr>();
    requiredAttrCount: number

    callback?: HandlerCallback
    itemCallback?: ItemCallback
    addedAttributeTables: Map<string, MountPoint> = new Map();

    constructor(attrs: MountAttrMap) {
        for (const [attr, attrConfig] of attrs.entries()) {
            this.attrs.set(attr, attrConfig);
        }

        this.requiredAttrCount = 0;
        for (const attrConfig of this.attrs.values())
            if (attrConfig.required)
                this.requiredAttrCount++;
    }

    has(attr: string) {
        return this.attrs.has(attr);
    }

    overlapsQuery(tags: QueryTag[]) {
        let foundRequiredCount = 0;

        // Check the query. Make sure it:
        //  - Only has tags that are either 'required' or 'optional'
        //  - Includes all of the 'required' tags
        //  - Matches the 'withValue' condition (if any)

        for (const tag of tags) {
            if (!tag.attr)
                continue;

            const attrConfig = this.attrs.get(tag.attr);

            if (!attrConfig) {
                return false;
            }

            if (attrConfig.withValue && tag.value.t === 'noValue') {
                return false;
            }

            if (attrConfig.withValue === false && tag.value.t !== 'noValue')
                return false;

            if (attrConfig.required)
                foundRequiredCount++;
        }

        return foundRequiredCount === this.requiredAttrCount;
    }

    callWithParams(params: Params) {
        if (this.callback) {
            try {
                let result: any = this.callback(params);

                if (result && result.then) {
                    // Implicit async
                    params.async();

                    result
                    .then(() => {
                        params.output.sendDoneIfNeeded();
                    })
                    .catch(e => {

                        if ((e as BackpressureStop).backpressure_stop) {
                            // Function is deliberately being killed by a BackpressureStop exception. Not an error.
                            params.output.sendDoneIfNeeded();
                            return;
                        }

                        console.error(e);
                        params.output.sendUnhandledError(e);
                        params.output.sendDoneIfNeeded();
                    });
                }
            } catch (e) {
                if ((e as BackpressureStop).backpressure_stop) {
                    // Function is deliberately being killed by a BackpressureStop exception. Not an error.
                    params.output.sendDoneIfNeeded();
                    return;
                }

                console.error(e);
                params.output.sendUnhandledError(e);
                params.output.sendDoneIfNeeded();
                return;
            }

            // Automatically call 'done' if the call is not async.
            if (!params.enabledAsync) {
                params.output.sendDoneIfNeeded();
            }

            return;
        }

        if (this.itemCallback) {
            this.itemCallback(params.queryToItem());
            return;
        }

    }

    callWithItem(item: Item, changeInfo?: any) {
        try {
            if (this.callback) {
                throw new Error('unimplemented callWithItem');
                return;
            }

            if (this.itemCallback) {
                this.itemCallback(item, changeInfo);
                return;
            }

        } catch (e) {
            console.error(e);
        }
    }

    getAddedAttribute(attr: string) {
        return this.addedAttributeTables.get(attr);
    }

    put() {
        return this.getAddedAttribute('put');
    }

    delete() {
        return this.getAddedAttribute('delete');
    }
}
