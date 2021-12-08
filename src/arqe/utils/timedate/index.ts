
import { zeroPad } from '..'

export function getDateStamp() {
    const now = new Date();
    return `${zeroPad(now.getUTCFullYear(), 4)}`
        +`-${zeroPad(now.getUTCMonth() + 1, 2)}`
        +`-${zeroPad(now.getUTCDate(), 2)}`;
}

