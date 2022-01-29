

function formatTagValue(value: any) {

    let str;

    if (typeof value === 'object') {
        str = JSON.stringify(value);
    } else {
        str = value + '';
    }

    let needsQuotes = false;
    for (let i=0; i < str.length; i++) {
        if (str[i] === ' ') {
            needsQuotes = true;
            break;
        }
    }

    if (needsQuotes)
        str = '"' + str + '"';

    return str;
}

export function formatItem(item: any) {
    const strs: string[] = []

    for (const [ key, value ] of Object.entries(item)) {
        if (value === null)
            strs.push(key);
        else
            strs.push(`${key}=${formatTagValue(value)}`);
    }

    return strs.join(' ');
}
