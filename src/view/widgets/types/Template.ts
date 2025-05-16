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
        FirstChar<T[K]> extends "f" ? number :
        FirstChar<T[K]> extends "i" ? number :
        FirstChar<T[K]> extends "s" ? string :
        FirstChar<T[K]> extends "l" ? string :
        FirstChar<T[K]> extends "b" ? boolean :
        FirstChar<T[K]> extends "a" ? any :
        never;
};

/**
 * Supported template types:
 * - `%o` or `%j` for any JSON serializable object
 * - `%d`, `%f` or %i for numbers
 * - `%s` for quoted strings
 * - `%l` for literal strings
 * - `%b` for booleans
 * - `%a` for any type which is JSON serializable
 */
export type Template<T extends string> = FilterTuple<SplitTemplate<Split<T, "%">>, never>;