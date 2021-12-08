
import Params from './Params'
import { MountPoint, HandlerCallback, ItemCallback } from './Mounts'
import { toQuery, QueryLike } from './Query'
import PreparedQuery from './PreparedQuery'
import { TableImplementationError } from './Errors'
import { Item } from './Item'

type StringSet = Map<string, true>
export type SetupCallback = (setup: Setup) => void

export interface MountAttr {
    required?: boolean
    withValue?: boolean
    assumeInclude?: boolean
}

export type MountAttrMap = Map<string, MountAttr>;

export interface TableBindParams {
    attrs?: string | string[] | { [attr: string]: MountAttr }
    name?: string
    run?: HandlerCallback
}

export interface MountPointSpec {
    attrs: MountAttrMap
    name?: string
    run?: HandlerCallback
}

export interface MountSpec {
    mounts: MountPointSpec[]
}

export class Setup {

    attrs: { [attr: string]: MountAttr } = {}
    _tableName: string
    aliasQuery: QueryLike
    runCallback: HandlerCallback
    parent: Setup
    children: Setup[] = []

    table(params: TableBindParams) {

        if ((params as any).requiredAttrs)
            throw new Error('requiredAttrs got deleted');
        if ((params as any).optionalAttrs)
            throw new Error('requiredAttrs got deleted');
        if (!params.attrs)
            throw new Error("table definition is missing .attrs");

        if (typeof params !== 'object')
            throw new TableImplementationError('table() expected object input');

        const child = new Setup();
        child.parent = this;
        child.attrs = {}

        const { name, attrs } = params;

        if (name) {
            child.tableName(name);
        }

        const isList = (Array.isArray(attrs) || typeof attrs === 'string')

        if (Array.isArray(attrs) || typeof attrs === 'string') {
            for (const attr of toList(attrs)) {
                child.attrs[attr] = child.attrs[attr] || {};
                child.attrs[attr].required = true;
            }
        } else {
            for (const [ attr, attrConfig ] of Object.entries(attrs)) {
                child.attrs[attr] = attrConfig;
            }
        }

        for (const [ attr, attrConfig ] of Object.entries(child.attrs)) {
            if (attrConfig.assumeInclude && attrConfig.required) {
                throw new Error("attr should not be assumeInclude=true and required=true");
            }

            if (attrConfig.assumeInclude)
                attrConfig.required = false;

            if (attrConfig.required == undefined)
                attrConfig.required = true;
        }

        this.children.push(child);

        if (params.run) {
            child.runCallback = params.run;
        }

        return child;
    }

    value(item: Item) {
        // TODO
    }

    mount(params: TableBindParams) {
        return this.table(params);
    }

    tableName(name: string) {
        this._tableName = name;
        return this;
    }

    get(callback: HandlerCallback) {
        if (this.runCallback) {
            throw new Error("already have a 'run' callback");
        }

        this.runCallback = callback;
        return this;
    }

    put(callback: HandlerCallback) {
        const subTable = this.table({ attrs: { put: {} }});
        return subTable.get(callback);
    }

    getAttrsWithInherited() {
        const result: MountAttrMap = new Map();

        for (const [key,value] of Object.entries(this.attrs))
            result.set(key,value);

        let parent = this.parent;

        let recursionLimit = 1000;

        while (parent) {
            if (recursionLimit-- <= 0)
                throw new Error("internal error: too many loops in getAttrsWithInherited");

            for (const [ attr, attrConfig ] of Object.entries(parent.attrs)) {
                result.set(attr, { ...attrConfig });
            }

            parent = parent.parent;
        }

        return result;
    }

    *iterateChildren(): IterableIterator<Setup> {
        yield this;

        for (const child of this.children) {
            yield* child.iterateChildren();
        }
    }

    toMountSpec(): MountSpec {
        const result: MountSpec = {
            mounts: []
        };

        for (const child of this.iterateChildren()) {
            if (child.runCallback) {

                result.mounts.push({
                    attrs: child.getAttrsWithInherited(),
                    name: child._tableName,
                    run: child.runCallback
                });
            }
        }

        return result;
    }
    
    prepareQuery(queryLike: QueryLike) {
        const query = toQuery(queryLike);
        if (query.t !== 'pipedQuery')
            throw new Error('expected pipedQuery');
        return new PreparedQuery(query);
    }

    alias(aliasQuery: QueryLike) {
        this.aliasQuery = aliasQuery;
    }
}

function toList(s: string | string[]) {
    if (Array.isArray(s))
        return s;
    return [s];
}
