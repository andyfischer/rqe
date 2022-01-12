
import { Step } from '../Step'

function prepare(step: Step) {
    // TODO
}

function run(step: Step) {
    let totalCount = 0;
    let bucketCount = 0;
    let startedBucket = Date.now();

    step.input.sendTo({
        receive(msg) {
            switch (msg.t) {
                case 'item':
                    totalCount++;
                    bucketCount++

                    if ((totalCount % 1000) === 0) {
                        const now = Date.now();
                        const elapsedSec = (now - startedBucket) / 1000;

                        let rate;

                        if (elapsedSec === 0)
                            rate = '(instant)'
                        else
                            rate = `${bucketCount / elapsedSec} per second`;

                        startedBucket = now;
                        bucketCount = 0;

                        step.put({ count: totalCount, rate });
                    }

                    break;
                default:
                    step.output.receive(msg);
            }
        }
    });
}

export const rate = {
    prepare,
    run,
}

