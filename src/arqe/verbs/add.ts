
import { Stream, joinStreams } from '../Stream'
import Params from '../Params'
import { runTableSearch } from '../runQuery'

export default function add(params: Params) {

    const { receivers, stream } = joinStreams(2);
    stream.sendTo(params.output);

    params.input.sendTo(receivers[0]);

    runTableSearch(params
                      .withVerb('get')
                      .withInput(Stream.newEmptyStream())
                      .withOutput(Stream.newStreamToReceiver(receivers[1])));
}

