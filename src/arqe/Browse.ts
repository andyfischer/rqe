
import { Setup } from './Setup'

export function setupBrowse(setup: Setup) {
    setup.table({
        attrs: {
            browse: {},
            name: { assumeInclude: true },
            attrs: { assumeInclude: true },
        },
    })
    .get(p => {
        const graph = p.graph;

        p.putHeader({ browse: null, name: null, attrs: null });

        for (const table of graph.everyTable()) {
            p.put({
                name: table.name,
                attrs: Array.from(table.attrs.entries()) as any,
            });
        }
    });
}
