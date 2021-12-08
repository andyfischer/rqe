
import Params from '../Params'

export default function last(params: Params) {
    let firstRecordedIndex = null;
    let lastRecordedIndex = null;
    let items = new Map<number, any>();
    const limit = parseInt(params.getPositionalAttr(0));

    if (limit === 0) {
        params.output.done();
        return;
    }

    params.input.sendTo({
        receive(data) {
            switch (data.t) {

            case 'done':
                for (const item of items.values())
                    params.output.receive(item);

                params.output.done();
                break;

            case 'item':
                if (firstRecordedIndex === null) {
                    firstRecordedIndex = 0;
                    lastRecordedIndex = 0;
                    items.set(lastRecordedIndex, data);
                } else {
                    lastRecordedIndex++;
                    items.set(lastRecordedIndex, data);

                    while ((lastRecordedIndex - firstRecordedIndex + 1) > limit) {
                        items.delete(firstRecordedIndex);
                        firstRecordedIndex++;
                    }
                }
                break;

            default:
                params.output.receive(data);
            }
        }
    })
}
