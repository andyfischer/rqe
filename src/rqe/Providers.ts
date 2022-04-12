
import { Graph } from './Graph'
import { Query } from './Query'
import { Stream } from './Stream'

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
