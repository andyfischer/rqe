
import Params from '../Params'

export default function reverse(params: Params) {

    const collection: any[] = [];

    params.input.sendTo({
        receive(data) {
            switch (data.t) {

            case 'done':
                collection.reverse();
                for (const item of collection)
                    params.output.put(item);
                params.output.done();
                break;

            case 'item':
                collection.push(data.item);
                break;

            default:
                params.output.receive(data);
            }
        }
    })
}
