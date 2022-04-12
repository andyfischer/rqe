
import { MountPoint, MountPointSpec } from './MountPoint'
import { Graph } from './Graph'
import { IDSourceNumber as IDSource } from './utils/IDSource'
import { ItemChangeListener } from './reactive/ItemChangeEvent'
import { CollectedMountLink, addMountThatHasSpecificValue } from './CollectedMounts'

function hasSpecificValue(point: MountPointSpec) {
    for (const attr of Object.values(point.attrs))
        if (attr.specificValue)
            return true;
    return false;
}

export class Module {
    graph: Graph
    moduleId: string
    points: MountPoint[] = []
    pointIds = new IDSource()

    // Derived:
    pointsById: Map<number, MountPoint>
    // collectedMountLinks: CollectedMountLink[]

    constructor(graph: Graph) {
        this.graph = graph;
        this.moduleId = graph.nextModuleId.take();
    }

    redefine(newSpecs: MountPointSpec[]) {

        const oldPoints = this.points;
        const newPoints = [];

        // Delete old derived state
        this.pointsById = new Map()
        /*
        for (const link of this.collectedMountLinks || []) {
            this.graph.collectedMounts().removeMount(link);
        }
        */

        for (const pointSpec of newSpecs) {
            /*
            if (hasSpecificValue(pointSpec)) {
                addMountThatHasSpecificValue(this.graph, pointSpec);
                continue;
            }
            */

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
        this.redefine([]);
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
