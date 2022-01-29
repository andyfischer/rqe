
import { Step } from '../Step'
import * as fs from 'fs'
import { formatAsCsv } from '../format/csv'

function run(step: Step) {
    const { filename } = step.queryToItem();
    if (!filename)
        throw new Error('save_to_csv requires: filename');

    step.input.then(result => {

        const out = fs.createWriteStream(filename);
        
        for (const line of formatAsCsv(result, {
            attrs: result.getEffectiveAttrs(),
            includeHeader: true
        })) {
            out.write(line);
        }

        out.end();

        step.output.done();
    });
}

export const save_to_csv = {
    run,
}

