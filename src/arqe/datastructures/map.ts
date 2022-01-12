
import { Setup } from '../Setup'
import { Step } from '../Step'
import { MountSpec, setupWithMountSpec } from '../Schema'

export interface MapMountConfig {
    map: Map<any,any>
    keyAttr: string
    valueAttr: string
    mount?: MountSpec
    name?: string
}

export function setupMap(setup: Setup, config: MapMountConfig) {

    const { map, keyAttr, valueAttr } = config;

    if (config.mount)
        setup = setupWithMountSpec(config.mount, setup);

    const table = setup.table({
        attrs: { [keyAttr]: {required:true}, [valueAttr]: { required: false } },
        run: (step: Step) => {
            if (step.hasValue(keyAttr)) {
                const key = step.get(keyAttr);

                if (map.has(key)) {
                    step.put({ [keyAttr]: key, [valueAttr]: map.get(key) });
                }
            } else {
                for (const [key,value] of map.entries()) {
                    step.put({ [keyAttr]: key, [valueAttr]: value });
                }
            }
        }
    });
}
