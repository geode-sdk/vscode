
export class Option<T> {
    value: T | undefined;

    constructor(value: T | undefined) {
        this.value = value;
    }

    unwrap(): T | never {
        if (!this.value) {
            throw new ReferenceError('unwrap() called on a None Option');
        }
        return this.value;
    }
    unwrapOr(value: T): T {
        return this.value ?? value;
    }
    isSome(): boolean {
        return this.value !== undefined;
    }
    isNone(): boolean {
        return this.value === undefined;
    }
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Some<T>(value: T | undefined): Option<T> {
    return new Option<T>(value);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const None = new Option<any>(undefined);

export class Result<T, E> {
    private isValue_: boolean;
    private value: T | E;

    private constructor(value: T | E, isValue: boolean) {
        this.isValue_ = isValue;
        this.value = value;
    }

    static ok<T>(value: T) {
        return new Result<T, any>(value, true);
    }

    static err<E>(error: E) {
        return new Result<any, E>(error, false);
    }

    unwrap(): T | never {
        if (!this.isValue) {
            throw new ReferenceError('unwrap() called on an Err Result');
        }
        return this.value as T;
    }

    unwrapErr(): E | never {
        if (this.isValue_) {
            throw new ReferenceError('unwrapErr() called on an Ok Result');
        }
        return this.value as E;
    }

    isValue(): boolean {
        return this.isValue_;
    }

    isError(): boolean {
        return !this.isValue_;
    }
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Ok<T>(value: T): Result<T, any>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Ok(): Result<undefined, any>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Ok(...args: any[]): Result<any, any> {
    return Result.ok(args[0]);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Err<E>(error: E): Result<any, E> {
    return Result.err(error);
}

export type Future<T, E> = Promise<Result<T, E>>;
