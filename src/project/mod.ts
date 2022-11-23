/* eslint-disable @typescript-eslint/naming-convention */

export interface Font {
    path: string,
    size: number,
    charset: string,
    outline: number,
}

export interface Resources {
    files?: string[] | null,
    sprites?: string[] | null,
    fonts?: { [name: string]: Font } | null,
    spritesheets?: { [name: string]: string[] } | null
}

export type Version = `v${number}.${number}.${number}` | `${number}.${number}.${number}`;

export type SettingType =
    'bool' | 'int' | 'float' | 'string' |
    'rgb' | 'color' | 'rgba' | 'path' | 'file' | 'custom';

export type Color =
    string |
    [number, number, number] |
    { r: number, g: number, b: number };

export type ColorAlpha =
    string |
    [number, number, number, number] |
    { r: number, g: number, b: number, a: number };

export interface ArrowsControl {
    'arrows'?: boolean,
    'arrow-step'?: number,
    'big-arrows'?: boolean,
    'big-arrow-step'?: number,
}

export interface InputControl {
    'input'?: boolean,
}

export interface SliderControl {
    'slider'?: boolean,
    'slider-step'?: number | null,
}

export interface FileFilter {
    description?: string,
    files?: string[],
}

export interface FileControl {
    'filters'?: FileFilter[]
}

export interface Setting {
    type: SettingType,
    name?: string,
    description?: string,
}

export interface IntSetting extends Setting {
    type: 'int',
    default: number,
    min?: number,
    max?: number,
    'one-of'?: number[],
    control: ArrowsControl & SliderControl & InputControl,
}

export interface FloatSetting extends Setting {
    type: 'float',
    default: number,
    min?: number,
    max?: number,
    'one-of'?: number[],
    control: ArrowsControl & SliderControl & InputControl,
}

export interface StringSetting extends Setting {
    type: 'string',
    default: string,
    match?: string,
    'one-of': string[],
}

export interface BoolSetting extends Setting {
    type: 'bool',
    default: boolean,
}

export interface ColorSetting extends Setting {
    type: 'color' | 'rgb',
    default: Color,
}

export interface ColorAlphaSetting extends Setting {
    type: 'rgba',
    default: ColorAlpha,
}

export interface FileSetting extends Setting {
    type: 'path' | 'file',
    default: string,
    control?: FileControl,
}

export type Settings = { [id: string]: Setting };

export interface Issues {
    info: string,
    url?: string,
}

export interface Dependency {
    id: string,
    version: Version,
    required?: boolean,
}

export interface Binary {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '*': string,
    auto: boolean,
    windows: string,
    macos: string,
    ios: string,
    android: string,
}

export interface ModJson {
    geode: Version,
    version: Version,
    id: string,
    name: string,
    developer: string,
    description?: string,
    repository?: string,
    dependencies?: Dependency[] | null,
    binary?: string | Binary,
    datastore?: any | null,
    resources?: Resources | null,
    settings?: Settings,
    issues?: Issues,
    toggleable?: boolean,
    unloadable?: boolean,
}

// Mod runtime info, queried through loader IPC

export interface RTHook {
    address: number,
    detour: number,
    name: string,
    enabled: boolean,
}

export interface RTPatch {
    address: number,
    original: number[],
    patch: number[],
    applied: boolean,
}

export interface ModRunTimeInfo {
    hooks: RTHook[],
    patches: RTPatch[],
    enabled: boolean,
    loaded: boolean,
    'temp-dir': string,
    'save-dir': string,
    'config-dir': string,
}

export interface RTModJson extends ModJson {
    path: string,
    binary: string,
    runtime: ModRunTimeInfo,
}
