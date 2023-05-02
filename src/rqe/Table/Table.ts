
import { Schema } from './Schema'
import { MultiMap } from '../utils/MultiMap'
import type { Stream } from '../Stream'
import type { StatusTableItem } from './StatusTable'

export interface Table<ItemType = any> {
    schema: Schema

    indexType: TableIndexType
    items: any
    attrData: Map<string, any>

    indexes: Map<string,TableIndex>

    insert?(item: ItemType): ItemType

    item_to_uniqueKey?(item: ItemType): any
    item_matches_uniqueKey?(item: ItemType, uniqueKey: any): boolean

    supportsFunc(funcName: string): boolean
    checkInvariants(): void

    // Listeners
    listen?(): Stream
    listenerStreams?: Stream[]

    // Status
    status?: Table<StatusTableItem>
    isLoading?(): boolean
    hasError?(): boolean
    waitForData?(): Promise<void>

    // Other functions added based on schema.funcs
    [ funcName: string ]: any
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
