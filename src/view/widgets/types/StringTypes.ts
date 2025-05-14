export type Split<T extends string, D extends string = ""> = T extends `${infer P}${D}${infer R}` ?
    R extends `` ?
        [P] :
        [P, ...Split<R, D>] :
    [T];

export type AnyCharacterOf<T extends string> = Split<T>[number];

export type FirstChar<T extends string> = T extends `${infer P}${string}` ? P : T;

export type BlacklistChars<T extends string, B extends string> = T extends `${string}${AnyCharacterOf<B>}${string}` ? never : T;