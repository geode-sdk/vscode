import { FirstChar, Split } from "./StringTypes";

export type FilterTuple<T extends any[], F> = T extends [infer P, ...infer R] ?
    [P] extends [F] ?
        FilterTuple<R, F> :
        [P, ...FilterTuple<R, F>] :
    [];

// Utility type, do not export
type SplitTemplate<T extends string[]> = {
    [K in keyof T]:
        FirstChar<T[K]> extends "o" ? object :
        FirstChar<T[K]> extends "j" ? object :
        FirstChar<T[K]> extends "d" ? number :
        FirstChar<T[K]> extends "i" ? number :
        FirstChar<T[K]> extends "f" ? number :
        FirstChar<T[K]> extends "s" ? string :
        never;
};

export type Template<T extends string> = FilterTuple<SplitTemplate<Split<T, "%">>, never>;