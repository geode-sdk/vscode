
export interface Char {
    id: number,
    x: number,
    y: number,
    width: number,
    height: number,
    xoffset: number,
    yoffset: number,
    xadvance: number,
    page: number,
    chnl: number,
}

export interface Kerning {
    first: number,
    second: number,
    amount: number,
}

export interface Info {
    face: string,
    size: number,
    bold: boolean,
    italic: boolean,
    charset: string,
    unicode: number,
    stretchH: number,
    smooth: number,
    aa: number,
    padding: [number, number, number, number],
    spacing: [number, number],
}

export interface Common {
    lineHeight: number,
    base: number,
    scaleW: number,
    scaleH: number,
    pages: number,
    packed: number,
    alphaChnl: number,
    redChnl: number,
    greenChnl: number,
    blueChnl: number,
}

export interface FontData {
    pages: string[],
    chars: Char[],
    kernings: Kerning[],
    info: Info,
    common: Common,
}

function parseData(data: string) {
    if (!data || data.length === 0) {
        return "";
    }
    if (data.indexOf('"') === 0 || data.indexOf("'") === 0) {
        return data.substring(1, data.length - 1);
    }
    if (data.indexOf(',') !== -1) {
        return parseIntList(data);
    }
    return parseInt(data, 10);
}

function parseIntList(data: string) {
    return data.split(',').map(val => parseInt(val, 10));
}

function parseLine(line: string, firstSpace: number) {
    const key = line.substring(0, firstSpace);

    interface DataValue {
        key: string,
        data: string | number | number[]
    }

    const data: DataValue[] = [];
    line
        // skip key
        .substring(firstSpace + 1)
        // remove "letter"
        .replace(/letter=[\'\"]\S+[\'\"]/gi, '')
        // split by key-value
        .split('=')
        // https://github.com/mattdesl/parse-bmfont-ascii/blob/master/index.js
        .map(str => str.trim().match(/(".*?"|[^"\s]+)+(?=\s*|\s*$)/g))
        .forEach((s, ix, arr) => {
            if (s) {
                if (ix === 0) {
                    data.push({
                        key: s[0],
                        data: ""
                    });
                } else if (ix === arr.length - 1) {
                    data[data.length - 1].data = parseData(s[0]);
                } else {
                    data[data.length - 1].data = parseData(s[0]);
                    data.push({
                        key: s[1],
                        data: ""
                    });
                }
            }
        });

    interface OutValue {
        key: string,
        data: any
    }

    const out: OutValue = {
        key: key,
        data: {}
    };
    data.forEach(v => out.data[v.key] = v.data);
    return out;
}

export function parseFnt(fntData: string) {
    const font: FontData = {
        pages: [],
        chars: [],
        kernings: [],
        info: {
            face: "",
            size: 32,
            bold: false,
            italic: false,
            charset: "",
            unicode: 0,
            stretchH: 0,
            smooth: 0,
            aa: 0,
            padding: [0, 0, 0, 0],
            spacing: [0, 0],
        },
        common: {
            lineHeight: 0,
            base: 0,
            scaleW: 0,
            scaleH: 0,
            pages: 0,
            packed: 0,
            alphaChnl: 0,
            redChnl: 0,
            greenChnl: 0,
            blueChnl: 0,
        },
    };
    
    for (let line of fntData.split(/\r\n?|\n/g)) {
        // normalize whitespace
        line = line.replace(/\s+/g, ' ').trim();
        if (!line.length) {
            continue;
        }
        const firstSpace = line.indexOf(' ');
        if (!firstSpace) {
            return null;
        }
        const parsed = parseLine(line, firstSpace);
        switch (parsed.key) {
            case 'page': {
                if (
                    typeof parsed.data.id !== 'number' || 
                    typeof parsed.data.file !== 'string'
                ) {
                    return null;
                }
                font.pages[parsed.data.id] = parsed.data.file;
            } break;

            case 'chars': case 'kernings': {} break;

            case 'char': {
                font.chars.push(parsed.data);
            } break;

            case 'kerning': {
                font.kernings.push(parsed.data);
            } break;

            default: {
                (font as any)[parsed.key] = parsed.data;
            } break;
        }
    }

    return font;
}
