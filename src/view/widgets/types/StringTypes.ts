export type Split<T extends string, D extends string> = T extends `${infer P}${D}${infer R}` ? [P, ...Split<R, D>] : [T];

export type FirstChar<T extends string> = T extends `${infer P}${string}` ? P : T;

export type BlacklistChars<T extends string, B extends string> = T extends `${string}${B}${string}` ? never : T;