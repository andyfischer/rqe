
import Params from '../Params'

export default function count(params: Params) {
    let count = 0;

    params.input.sendTo({
        receive(data) {
            switch (data.t) {

            case 'done':
                params.output.put({ count });
                params.output.done();
                break;

            case 'item':
                count++;
                break;

            default:
                params.output.receive(data);
            }
        }
    })
}
