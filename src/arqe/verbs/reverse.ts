
import { Step } from '../Step'
import { aggregationVerb } from './_shared'

export const reverse = aggregationVerb((items) => {
    return items.reverse();
});
