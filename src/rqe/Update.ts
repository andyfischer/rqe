
import { Item } from './Item'
import { unwrapTagged } from './TaggedValue'
import { QueryStep } from './Query'
import { isItem } from './Item'
import { Graph } from './Graph'

export function updateItemUsingQuery(graph: Graph, item: Item, updateStep: QueryStep) {
    /*
       Go through all the attrs in 'updateStep' and apply them as updates to the item.
       Some attrs might include nested queries for nested updates.
    */
   
    for (const [ attr, queryAttr ] of Object.entries(updateStep.attrs)) {

        const queryValue = queryAttr.value;

        if (queryValue.t === 'step' && queryValue.verb === 'get') {

            if (!isItem(item[attr]))
                throw new Error("expected nested object for: " + attr);

            const nestedValue = { ...item[attr] };

            // TODO: recursively call updateItemUsingQuery here?
            for (const [ nestedAttr, nestedDetails ] of Object.entries(queryValue.attrs)) {
                nestedValue[nestedAttr] = unwrapTagged(nestedDetails.value);
            }
            item[attr] = nestedValue;

            continue;
        }

        if (queryValue.t === 'step' || queryValue.t === 'query') {
            if (!isItem(item[attr]))
                throw new Error("expected nested object for: " + attr);

            const nestedValue = { ...item[attr] };

            const result = graph.transform(queryValue, [ nestedValue ]);

            // TODO: support async here
            const updated = result.sync().one();

            item[attr] = updated;

            continue;
        }

        item[attr] = unwrapTagged(queryAttr.value);
    }
}
