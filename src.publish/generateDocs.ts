
import { spawn } from '../src/rqe/node/shell'

async function run(cmd: string, options?: any) {
    console.log('run: ' + cmd);
    for await (const item of spawn(cmd, options).output) {
        if (item.t === 'stdout' || item.t === 'stderr')
            console.log(item.line);
    }
}

export async function generateDocs() {
    await run('mkdir -p dist/api-extractor');
    await run('node_modules/.bin/api-extractor run --local');
    await run('node_modules/.bin/api-documenter markdown -i temp -o docs/api');
    await run('mv docs/api/* docs', { shell: true });
}

generateDocs()
.catch(err => {
    process.exitCode = -1;
    console.error(err);
});
