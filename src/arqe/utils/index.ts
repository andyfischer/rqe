
export function print(...args: string[]) {

    console.log(args);
}

export function printError(err) {
    const message = err.message || '';

    if (message.startsWith('[external] ')) {
        print(message.replace('[external] ', ''));
        return;
    }

    console.log(err.stack || err);
}

const hexLetters = ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'];

export function randomHex(length: number) {
    let out = '';

    while (length > 0) {
        const letter = hexLetters[Math.floor(Math.random() * hexLetters.length)];
        out += letter;
        length--;
    }

    return out;
}

export function toSet(items: string[])  {
    const set: { [key: string]: boolean } = {}
    for (const item of items) {
        set[item] = true;
    }
    return set;
}

export function freeze(value) {
    return JSON.parse(JSON.stringify(value));
}

export function allTrue(items: boolean[]) {
    for (const item of items)
        if (!item)
            return false;
    return true;
}

export function values(obj: any) {
    const out = [];
    for (const k in obj) {
        out.push(obj[k]);
    }
    return out;
}

export async function timedOut(p: Promise<any>, ms: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
        setTimeout((() => resolve(true)), ms);
        p.then(() => resolve(false));
    }) as Promise<any>;
}

export function isRunningInNode() {
    return (typeof module !== 'undefined' && module.exports);
}

export function zeroPad(num: number|string, len: number) {
    num = num + '';
    while (num.length < len)
        num = '0' + num;
    return num;
}
