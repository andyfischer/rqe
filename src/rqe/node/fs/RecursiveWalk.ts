
import Fs from 'fs/promises'
import Path from 'path'

interface Options {
    ignorePath?: (path: string) => boolean
}

export async function* recursiveWalk(path: string, options: Options = {}) {
    if (options.ignorePath && options.ignorePath(path))
        return;

    if ((await Fs.lstat(path)).isDirectory()) {
        const dir = path;
        for (const directoryFile of await Fs.readdir(dir)) {
            const relativePath = Path.join(dir, directoryFile);
            for await (const recursiveFile of recursiveWalk(relativePath, options))
                yield recursiveFile;
        }
    } else {
        yield path;
    }
}

