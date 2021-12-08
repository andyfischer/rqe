
import Params from '../Params'

export default function value(params: Params) {
    params.output.put(params.queryToItem());
    params.input.sendTo(params.output);
}
