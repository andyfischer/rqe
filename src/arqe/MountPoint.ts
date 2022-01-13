
import { QueryTag } from './Query'
import { Step } from './Step'
import { Setup, HandlerCallback } from './Setup'
import { Item } from './Item'
import { BackpressureStop } from './Stream'
import { Module } from './Module'
import { MountPointRef } from './PlannedQuery'
import { valueToString } from './Debug'

export interface MountAttr {
    required?: boolean
    withValue?: boolean
    assumeInclude?: boolean
}

export interface MountPointSpec {
    t?: 'mountPointSpec'
    name?: string
    attrs: { [attr: string]: MountAttr }
    run?: HandlerCallback
    localId?: number
    providerId?: string
}

export interface MountSpec {
    points: MountPointSpec[]
}

export class MountPoint {
    name: string
    localId: number
    providerId?: string

    spec: MountPointSpec
    attrs = new Map<string, MountAttr>();
    requiredAttrCount: number
    module: Module

    callback?: HandlerCallback

    addedAttributeTables: Map<string, MountPoint> = new Map();

    constructor(spec: MountPointSpec, module?: Module) {
        this.spec = spec;
        this.name = spec.name;
        this.module = module;
        this.callback = spec.run;
        this.providerId = spec.providerId;
        this.localId = spec.localId;

        const attrs = spec.attrs;
        for (const [attr, attrConfig] of Object.entries(attrs)) {
            this.attrs.set(attr, attrConfig);
        }

        this.requiredAttrCount = 0;
        for (const attrConfig of this.attrs.values())
            if (attrConfig.required)
                this.requiredAttrCount++;
    }

    getRef(): MountPointRef {
        if (!this.localId)
            throw new Error("can't getRef, this MountPoint has no localId");

        return { pointId: this.localId, moduleId: this.module.moduleId };
    }

    has(attr: string) {
        return this.attrs.has(attr);
    }

    callWithParams(step: Step) {

        step.graph.logging.put('execution', `call_mount_point: mount=${this.name} tuple=${valueToString(step.tuple)}`);

        if (this.callback) {
            try {
                let result: any = this.callback(step);

                if (result && result.then) {
                    // Implicit async
                    step.async();

                    result
                    .then(() => {
                        step.output.sendDoneIfNeeded();
                    })
                    .catch(e => {
                        if ((e as BackpressureStop).backpressure_stop) {
                            // Function is deliberately being killed by a BackpressureStop exception. Not an error.
                            step.output.sendDoneIfNeeded();
                            return;
                        }

                        step.output.sendUnhandledError(e);
                        step.output.sendDoneIfNeeded();
                        return;
                    });
                }
            } catch (e) {
                if ((e as BackpressureStop).backpressure_stop) {
                    // Function is deliberately being killed by a BackpressureStop exception. Not an error.
                    step.output.sendDoneIfNeeded();
                    return;
                }

                step.output.sendUnhandledError(e);
                step.output.sendDoneIfNeeded();
                return;
            }

            // Automatically call 'done' if the call is not async.
            if (!step.enabledAsync) {
                step.output.sendDoneIfNeeded();
            }

            return;
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
