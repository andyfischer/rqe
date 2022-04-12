
/*
  Use case:

  Client mounts points with specific values, like (connection=1 x y) and (connection=2 x y)

  For the overall pattern, a Collection will be created with (connection x y)

  This class keeps track of dispatching to each underlying mount with a specific value.
*/

import { Graph } from './Graph'
import { IDSource } from './utils/IDSource'
import { MountPointSpec } from './MountPoint'
import { Module } from './Module'
import { Step } from './Step'
import { QueryStep } from './Query'

export interface CollectedMountLink {
    collectionId: string
    localMountId: string
}

export class Collection {
    collectionId: string
    nextLocalId = new IDSource();
    point: MountPointSpec
    valueAttrs: string[]
    module: Module
    
    mounts = new Map<string, MountPointSpec>();

    constructor(graph: Graph, point: MountPointSpec) {
        const exposedPoint: MountPointSpec = {
            attrs: { },
            run: (step: Step) => {
                if (this.stepFetchesAllValues(step)) {
                    /*

                    const combinedStreams: Stream[] = [];

                    for (const mount of this.mounts.values()) {
                    }

                    return;
                    */
                }

                const key = this.queryToKey(step.tuple);
                const mount = this.mounts.get(key);
                if (!mount)
                    throw new Error("collected mount - specific value not found");

                return mount.run(step);
            }
        };

        const valueAttrs: string[] = [];

        for (const [attr, details] of Object.entries(point.attrs)) {
            if (details.specificValue) {
                valueAttrs.push(attr);
                exposedPoint.attrs[attr] = { ...details, specificValue: null };
            } else {
                exposedPoint.attrs[attr] = details;
            }
        }

        this.module = graph.createEmptyModule();
        this.module.redefine([ exposedPoint ]);

        if (valueAttrs.length === 0)
            throw new Error("internal error: empty valueAttrs list");

        this.point = point;
        this.valueAttrs = valueAttrs;
    }

    queryToKey(tuple: QueryStep) {
        const out = [];
        for (const attr of this.valueAttrs) {
            out.push(attr);
            out.push(tuple.attrs[attr].value);
        }
        return JSON.stringify(out);
    }

    stepFetchesAllValues(step: Step) {
        for (const attr of this.valueAttrs)
            if (!step.hasValue(attr))
                return true;
        return false;
    }

    specificPointToKey(specific: MountPointSpec) {
        const out = [];
        for (const attr of this.valueAttrs) {
            out.push(attr);
            out.push(specific.attrs[attr].specificValue);
        }
        return JSON.stringify(out);
    }

    addSpecificPoint(specific: MountPointSpec) {
        const key = this.specificPointToKey(specific);
        this.mounts.set(key, specific);
    }
}

export class CollectedMountGraph {
    graph: Graph

    collections = new Map<string, Collection>()

    constructor(graph: Graph) {
        this.graph = graph;
    }

    findOrCreateMountCollection(point: MountPointSpec) {
        const key = getMountKey(point);

        const existing = this.collections.get(key);
        if (existing)
            return existing;
            
        const collection = new Collection(this.graph, point);
        this.collections.set(key, collection);
        return collection;
    }

    removeMount(link: CollectedMountLink) {
        // TODO
    }
}

function getMountKey(mount: MountPointSpec) {
    const attrs = Array.from(Object.keys(mount.attrs));
    attrs.sort();
    return JSON.stringify(attrs);
}

export function addMountThatHasSpecificValue(graph: Graph, point: MountPointSpec) {
    const collection = graph.collectedMounts().findOrCreateMountCollection(point);
    collection.addSpecificPoint(point);
}
