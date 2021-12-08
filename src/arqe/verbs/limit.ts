
import Params from '../Params'

export default function limit(params: Params) {

    const limit = parseInt(params.getPositionalAttr(0));
    let count = 0;

    let limitReached = false;

    function setLimitReached() {
        params.input.setBackpressureStop();
        limitReached = true;
    }

    if (limit === 0) {
        setLimitReached();
        params.output.done();
        return;
    }

    params.input.sendTo({
        receive(data) {
            switch (data.t) {

            case 'done':
                if (!limitReached)
                    params.output.done();
                break;

            case 'item':
                count++;

                if (count > limit)
                    return;

                params.output.receive(data);

                if (count == limit) {
                    params.output.done();
                    setLimitReached();
                }
                break;

            default:
                params.output.receive(data);
            }
        }
    })
}
