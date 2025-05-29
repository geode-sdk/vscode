export type Option<T> = T | undefined;

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Some<T>(value: T): Option<T> {
    return value;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const None = undefined;

export class Result<T = undefined, E = string> {

    public static ok<T>(value: T) {
        return new Result<T, never>(value, true);
    }

    public static err<E>(error: E) {
        return new Result<never, E>(error, false);
    }

    private readonly hasValue: boolean;

    private readonly value: T | E;

    private constructor(value: T | E, isValue: boolean) {
        this.hasValue = isValue;
        this.value = value;
    }

    public getValue(): Option<T> {
        return this.hasValue ? this.value as T : undefined;
    }

    public getError(): Option<E> {
        return !this.hasValue ? this.value as E : undefined;
    }

    public unwrap(): T {
        if (!this.hasValue) {
            throw new ReferenceError("unwrap() called on an Err Result");
        }

        return this.value as T;
    }

    public unwrapErr(): E {
        if (this.hasValue) {
            throw new ReferenceError("unwrapErr() called on an Ok Result");
        }

        return this.value as E;
    }

    public try(): T {
        if (!this.hasValue) {
            throw new ReferenceError(this.value as E extends string ? E : never);
        }

        return this.value as T;
    }

    public isValue(): boolean {
        return this.hasValue;
    }

    public isError(): boolean {
        return !this.isValue;
    }

    public map<T2>(mapper: (value: T) => T2): Result<T2, E> {
        if (this.hasValue) {
            return Result.ok(mapper(this.unwrap()));
        } else {
            return Result.err(this.unwrapErr());
        }
    }

    public async awaitMap<T2>(mapper: (value: T) => Promise<T2>): Future<T2, E> {
        if (this.hasValue) {
            return Result.ok(await mapper(this.unwrap()));
        } else {
            return Result.err(this.unwrapErr());
        }
    }

    public replace<T2>(value: T2) : Result<T2, E> {
        return this.map(() => value);
    }
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Ok<T>(value: T): Result<T, never>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Ok(): Result<undefined, never>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Ok<T>(...args: T[]): Result<T, never> {
    return Result.ok(args[0]);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Err<E>(error: E): Result<never, E> {
    return Result.err(error);
}

export type Future<T = undefined, E = string> = Promise<Result<T, E>>;
