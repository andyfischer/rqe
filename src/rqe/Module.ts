
import { Setup } from './Setup'
import { MountPoint, MountSpec } from './MountPoint'
import { Graph } from './Graph'
import { IDSourceNumber as IDSource } from './utils/IDSource'
import { ItemChangeListener } from './reactive/ItemChangeEvent'

export class Module {
    graph: Graph
    moduleId: string
    points: MountPoint[] = []
    pointIds = new IDSource()
    pointsById: Map<number, MountPoint>

    constructor(graph: Graph, setup?: Setup) {
        this.graph = graph;
        this.moduleId = graph.nextModuleId.take();
        if (setup)
            this.redefine(setup.toMountSpec());
    }

    redefine(spec: MountSpec) {

        const oldPoints = this.points;
        const newPoints = [];
        this.pointsById = new Map()

        for (const pointSpec of spec.points) {
            pointSpec.localId = pointSpec.localId || this.pointIds.take();
            if (this.pointsById.has(pointSpec.localId))
                throw new Error("module already has a point with id: " + pointSpec.localId);

            const point = new MountPoint(pointSpec, this);
            newPoints.push(point);
            this.pointsById.set(pointSpec.localId, point);
        }

        this.points = newPoints;

        for (const listener of this.graph.schemaListeners) {
            this.sendUpdate(listener);
        }
    }

    clear() {
        this.redefine({ points: [] });
    }

    sendUpdate(listener: ItemChangeListener) {
        listener({
            verb: 'update',
            item: {
                id: this.moduleId,
                points: this.points,
            }
        });
    }
}

/*

notes and decision records:

A module is a set of mount points.

When setting up the module, we always deal with the points as an atomic list
(instead of having operations to add & remove individual points). This is
because the module contents often have hard interdependencies, and it would
be broken if we had one mount point calling an older version of another
mount point in the same module. When we redefine the entire list as a group,
we're always moving the graph from valid state -> to valid state.


*/
