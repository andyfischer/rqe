
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

