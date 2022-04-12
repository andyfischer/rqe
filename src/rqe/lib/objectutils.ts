
import { declare } from '../globalGraph'
import { Step } from '../Step'

function getType(value) {
    if (Array.isArray(value))
        return 'array';

    if (value === null)
        return 'null';

    if (value === undefined)
        return 'undefined';

    return typeof value;
}

declare('diff_objects: base compare -> difference path base_value compare_value', function ({ base, compare }, step: Step) {

    function checkValue(path: string, base_value, compare_value) {
        if (base_value === undefined && compare_value === undefined)
            return;

        if (compare_value === undefined) {
            step.put({ path, base_value, compare_value: null, difference: 'removed' });
            return;
        }

        const baseType = getType(base_value);
        const compareType = getType(compare_value);

        if (baseType !== compareType) {
            step.put({ path, base_value, compare_value, difference: 'changed' });
            return;
        }

        if (baseType === 'array') {
            for (let i = 0; i < (base_value as Array<any>).length; i++) {
                checkValue(path + i + '.', base_value[i], compare_value[i]);
            }
            return;
        }

        if (baseType === 'object') {
            for (const [ key, nested_base_value ] of Object.entries(base_value)) {
                const nested_compare_value = compare_value[key];

                checkValue(path + '.' + key, nested_base_value, nested_compare_value);
            }

            for (const key of Object.keys(compare_value)) {
                if (base_value[key] === undefined) {
                    step.put({ path: path + '.' + key, base_value: null, compare_value: compare_value[key], difference: 'added' });
                }
            }

            return;
        }

        if (base_value !== compare_value)
            step.put({ path, base_value, compare_value, difference: 'changed' });
    }

    checkValue('', base, compare);
});
