
import type { Schema } from './Schema'
import type { MultiMap } from '../utils/MultiMap'
import type { Stream } from '../Stream'
import type { StatusTableItem } from './StatusTable'
import type { DiffItem } from './diff'
import type { StreamToTableCallbacks } from './streamToTable'

export interface Table<ItemType = any> {
    schema: Schema

    indexType: TableIndexType
    items: any
    attrData: Map<string, any>

    indexes: Map<string,TableIndex>

    insert(item: ItemType): ItemType

    // Single value functions
    set?(item: ItemType): void
    get?(): ItemType

    // Typical accessors
    listAll?(): ItemType[]

    item_to_uniqueKey?(item: ItemType): any
    item_matches_uniqueKey?(item: ItemType, uniqueKey: any): boolean

    supportsFunc(funcName: string): boolean
    checkInvariants(): void

    // Listeners
    listen?(): Stream
    listenerStreams?: Stream[]
    listenToStream?(stream: Stream, callbacks?: StreamToTableCallbacks): void

    // Diff
    diff?(compare: Table): IterableIterator<DiffItem>

    // Status
    status?: Table<StatusTableItem>
    isLoading?(): boolean
    hasError?(): boolean
    waitForData?(): Promise<void>

    // Debug functions
    consoleLog?(): void

    // Common functions
    each?(): IterableIterator<ItemType>
    eachWithFilter?(condition: (item:ItemType) => boolean): IterableIterator<ItemType>

    // Other functions added based on schema.funcs
    [ funcName: string ]: any

    /*
     Generated functions can include:

     get_with_<attr>(attrValue: any): ItemType
       - Return a single items where attr = attrValue. If there are multiple matches, return the first.
     list_with_<attr>(attrValue: any): ItemType[]
       - Return an Array of items where attr = attrValue
     */
}

export interface MultiMapIndex {
    indexType: 'multimap'
    items: MultiMap<any,any>
}

export interface MapIndex {
    indexType: 'map'
    items: Map<any,any>
}

export interface ListIndex {
    indexType: 'list'
    items: Array<any>
}

export interface SingleValueIndex {
    indexType: 'single_value'
    items: any[]
}

export type TableIndexType = 'map' | 'list' | 'multimap' | 'single_value'
export type TableIndex = MapIndex | MultiMapIndex | ListIndex | SingleValueIndex
