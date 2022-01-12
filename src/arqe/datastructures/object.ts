
import { Setup } from '../Setup'
import { Step } from '../Step'
import { MountSpec, setupWithMountSpec } from '../Schema'

export interface ObjectMountConfig {
    object: any
    keyAttr: string
    valueAttr: string
    mount?: MountSpec
    name?: string
}

export function setupObject(setup: Setup, config: ObjectMountConfig) {
    const { object, keyAttr, valueAttr } = config;
    if (config.mount)
        setup = setupWithMountSpec(config.mount, setup);

    const table = setup.table({ attrs: { [keyAttr]: {required:true}, [valueAttr]: { required: false } }});

    if (config.name)
        table.tableName(config.name);

    table.run((params: Step) => {

        if (params.hasValue(keyAttr)) {
            const key = params.get(keyAttr);

            params.put({[valueAttr]: object[key]});
        } else {
            for (const [key, value] of Object.entries(object)) {
                params.put({[keyAttr]: key, [valueAttr]: value} as any);
            }
        }
    });
}
