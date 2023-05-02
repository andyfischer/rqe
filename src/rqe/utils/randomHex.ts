
const hexAlphanumeric = '0123456789abcdef';
const hexAlpha = 'abcdef';

function randInt(max: number) {
    return Math.floor(Math.random() * Math.floor(max));
}

export function randomHex(length: number) {
    let out = '';

    length--;

    out += hexAlpha[randInt(hexAlpha.length)];

    while (length > 0) {
        out += hexAlphanumeric[randInt(hexAlphanumeric.length)];
        length--;
    }
    return out;
}

