
import { Graph } from './Graph'
import { Table } from './Table'
import { Query } from './Query'
import { Stream } from './Stream'
import { Step } from './Step'

export interface Provider {
    provider_id?: string
    runQuery(query: Query, input: Stream): Stream
}

export function newProviderTable(graph: Graph) {
    return graph.newTable<Provider>({
        attrs: {
            provider_id: { generate: { method: 'increment', prefix: 'provider-' }},
            runQuery: { },
        },
    })
}
