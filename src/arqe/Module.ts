
import { Setup } from './Setup'
import { MountPoint } from './Mounts'

export class Module {
    tables: MountPoint[]

    constructor(setup?: Setup) {
        if (setup)
            this.redefine(setup);
    }

    redefine(setup: Setup) {
        this.tables = [];

        const spec = setup.toMountSpec();

        for (const pointSpec of spec.mounts) {
            const point = new MountPoint(pointSpec.attrs);
            point.name = pointSpec.name;
            point.callback = pointSpec.run;
            this.tables.push(point);
        }
    }
}
