
export interface Font {
    path: string,
    size: number,
    charset: string,
    outline: number,
}

export interface Resources {
    files?: string[],
    fonts?: { [name: string]: Font },
    spritesheets?: { [name: string]: string[] }
}

export interface ModJson {
    id: string,
    name: string,
    resources?: Resources,
}
