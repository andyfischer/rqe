
import { Setup } from '../Setup'
import { Step } from '../Step'
import { MountSpec, setupWithMountSpec } from '../Schema'
import { parseTableDecl } from '../parser/parseTableDecl'

export interface MapMountConfig {
    map: Map<any,any>
    func: string
    mount?: MountSpec
    name?: string
}

export function setupMap(setup: Setup, config: MapMountConfig) {

    let { map, func } = config;

    if (config.mount)
        setup = setupWithMountSpec(config.mount, setup);

    const mountSpec = parseTableDecl(func);

    if (mountSpec.t === 'parseError')
        throw new Error(mountSpec.message);

    const required = [];
    const optional = [];
    for (const [attr,config] of Object.entries(mountSpec.attrs)) {
        if (config.required)
            required.push(attr);
        else
            optional.push(attr);
    }
    if (required.length !== 1)
        throw new Error("Expected one input attribute: " + func);
    if (optional.length !== 1)
        throw new Error("Expected one output attribute: " + func);

    let keyAttr = required[0];
    let valueAttr = optional[0];

    mountSpec.run = (step: Step) => {
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

    setup.bind(mountSpec);
}
