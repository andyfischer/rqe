
import Params from '../Params'
import * as fs from 'fs'
import { formatAsCsv } from '../format/csv'

export default function saveToCsv(params: Params) {
    const { filename } = params.queryToItem();
    if (!filename)
        throw new Error('save_to_csv requires: filename');

    params.input.then(result => {

        const out = fs.createWriteStream(filename);
        
        for (const line of formatAsCsv(result, {
            attrs: result.getEffectiveAttrs(),
            includeHeader: true
        })) {
            out.write(line);
        }

        out.end();

        params.output.done();
    });
}
