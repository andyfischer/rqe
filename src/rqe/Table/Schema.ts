
import { Table, TableIndex, TableIndexType } from './Table'
import { PreInsertStep, TableInitStep } from './CompiledSteps'
import { SchemaDecl, compileSchema } from './compileSchema'
import { MultiMap } from '../utils/MultiMap'
import { createTable } from './createTable'

export function fromLooseSchema(loose: LooseSchema): Schema {
    if (loose instanceof Schema)
        return loose;

    return compileSchema(loose as SchemaDecl);
}

export type LooseSchema = Schema | SchemaDecl

export class SchemaAttr {
    attr: string
    isAuto?: boolean
    frozen: boolean

    constructor(attr: string) {
        this.attr = attr;
    }

    freeze() {
        if (this.frozen)
            return;

        this.frozen = true;
        Object.freeze(this);
    }
}

export class SchemaFunc {
    name: string
    handler: (table: Table, args: any) => any
}

export class IndexSchema {
    name: string
    indexType: TableIndexType
    attrs: string[]

    createForTable(): TableIndex {
        switch (this.indexType) {
            case 'map':
                return {
                    indexType: 'map',
                    items: new Map()
                }

            case 'list':
                return {
                    indexType: 'list',
                    items: []
                }

            case 'multimap':
                return {
                    indexType: 'multimap',
                    items: new MultiMap()
                }

            case 'single_value':
                return {
                    indexType: 'single_value',
                    items: [null],
                }
        }

        throw new Error("IndexSchema internal error: unrecognized type: " + this.indexType);
    }
}

export class Schema<TableType extends Table<any> = Table<any>> {
    name: string
    decl: SchemaDecl
    attrs: SchemaAttr[] = []
    funcs = new Map<string, SchemaFunc>()
    indexes: IndexSchema[] = []
    primaryUniqueIndex: IndexSchema
    defaultIndex: IndexSchema
    supportsListening: boolean
    supportsStatusTable: boolean

    setupTable: TableInitStep[] = []
    preInsert: PreInsertStep[] = []

    frozen: boolean

    constructor(decl: SchemaDecl) {
        this.decl = decl;
        this.name = decl.name;
    }

    freeze() {
        if (this.frozen)
            return;
        for (const attr of this.attrs)
            attr.freeze();
        this.frozen = true;
        Object.freeze(this);
    }

    createTable(): TableType {
        return createTable(this) as TableType;
    }

    addFuncs(funcs: string[]) {
        const updatedDecl = {
            ...this.decl,
            funcs: this.decl.funcs.concat(funcs)
        }
        return compileSchema(updatedDecl);
    }
}
