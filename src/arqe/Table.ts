
import { Graph } from './Graph'
import { TableSchema } from './Schema'
import { Item } from './Item'

export interface ItemChangeEvent {
    verb: 'put' | 'delete'
    writer?: string
    item: Item
}

export type ItemChangeListener = (evt: ItemChangeEvent) => void

export interface Table {
    schema(): TableSchema
    name(): string
    scan(): Iterable<any>
    list(): any[]
    column(attr: string): Iterable<string>
    strs(): string[]
    hasError(): boolean
    warnings(): any[]
    errors(): any[]
}
