
import { Setup } from './Setup'

export function setupBrowse(setup: Setup) {
    setup.table({
        attrs: {
            browse: {},
            name: { assumeInclude: true },
            attrs: { assumeInclude: true },
            provider_id: { assumeInclude: true },
        },
    })
    .get(p => {
        const graph = p.graph;

        p.putHeader({ browse: null, name: null, attrs: null });

        for (const point of graph.everyTable()) {
            p.put({
                name: point.name,
                attrs: Array.from(point.attrs.entries()) as any,
                provider_id: point.providerId,
            });
        }
    });
}
