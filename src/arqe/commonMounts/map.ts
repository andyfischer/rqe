
import { Setup } from '../Setup'
import Params from '../Params'
import { MountSpec, setupWithMountSpec } from '../Schema'

export interface MapMountConfig {
    map: Map<any,any>
    keyAttr: string
    valueAttr: string
    mount?: MountSpec
    name?: string
}

export function mountMap(setup: Setup, config: MapMountConfig) {

    const { map, keyAttr, valueAttr } = config;

    if (config.mount)
        setup = setupWithMountSpec(config.mount, setup);

    const table = setup.table({
        attrs: { [keyAttr]: {required:true}, [valueAttr]: { required: false } }
    });

    table.get((params: Params) => {
        const key = params.get(keyAttr);

        if (map.has(key)) {
            params.put({[keyAttr]: key, [valueAttr]: map.get(key)});
        }
    });
}
