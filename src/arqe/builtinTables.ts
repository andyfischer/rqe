
import Params from './Params'
import { Setup } from './Setup'
import { Graph } from './Graph'

export const everyBuiltinTable: { [name: string]: (graph: Graph) => void }  = {
    'list-tables': (graph: Graph) => {
        graph.createModule((setup: Setup) => {
            setup.table({ attrs: {
                'list-tables': {},
                'name': {
                    required: false,
                    assumeInclude: true
                },
                'attrs': {
                    required: false,
                    assumeInclude: true
                },
            }})
            .get(params => {
                for (const table of params.graph.everyTable()) {
                    params.output.put({
                        name: table.name,
                        attrs: Array.from(table.attrs.entries()) as any,
                    });
                }
            })
        })
    },
}
