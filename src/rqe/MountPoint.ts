
import { HandlerCallback } from './Setup'
import { Module } from './Module'
import { MountPointRef } from './FindMatch'
import { TaggedValue } from './TaggedValue'

export interface MountAttr {
    required?: boolean
    requiresValue?: boolean
    specificValue?: TaggedValue
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
    attrs: { [attr: string]: MountAttr }
    requiredAttrCount: number
    module: Module

    callback?: HandlerCallback

    addedAttributeTables: Map<string, MountPoint> = new Map();

    constructor(spec: MountPointSpec, module?: Module) {
        spec.t = 'mountPointSpec';

        this.spec = spec;
        this.name = spec.name;
        this.module = module;
        this.callback = spec.run;
        this.providerId = spec.providerId;
        this.localId = spec.localId;
        this.attrs = spec.attrs;

        this.requiredAttrCount = 0;
        for (const attrConfig of Object.values(this.attrs))
            if (attrConfig.required)
                this.requiredAttrCount++;
    }

    getRef(): MountPointRef {
        if (!this.localId)
            throw new Error("can't getRef, this MountPoint has no localId");

        return { pointId: this.localId, moduleId: this.module.moduleId };
    }

    has(attr: string) {
        return this.attrs[attr] !== undefined;
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

export function mountSpecPlusAttr(spec: MountPointSpec, addedAttr: string): MountPointSpec {
    return {
        name: spec.name + '/' + addedAttr,
        attrs: {
            ...spec.attrs,
            [addedAttr]: { required: true },
        }
    }
}

export function mountAttrToString(attr: string, details: MountAttr) {
    let out = attr;

    if (!details.required && !details.requiresValue)
        out += '?';

    if (details.requiresValue)
        out += '=x'

    return out;
}

export function pointSpecToString(spec: MountPointSpec) {
    const out = [];

    for (const [ attr, details ] of Object.entries(spec.attrs)) {
        out.push(mountAttrToString(attr, details));
    }

    return out.join(' ');
}

