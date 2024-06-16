// a monad is just a monoid in the category of endofunctors :3

export type Option<T> = T | undefined;

export function Some<T>(value: T): Option<T> {
	return value;
}

export const None = undefined;

export class Result<T = undefined, E = string> {
	#isValue: boolean;
	#value: T | E;

	private constructor(value: T | E, isValue: boolean) {
		this.#isValue = isValue;
		this.#value = value;
	}

	static ok<T>(value: T) {
		return new Result<T, never>(value, true);
	}

	static err<E>(error: E) {
		return new Result<never, E>(error, false);
	}

	unwrap(): T | never {
		if (!this.#isValue)
			throw new ReferenceError('unwrap() called on an Err Result');

		return this.#value as T;
	}

	unwrapErr(): E | never {
		if (this.#isValue)
			throw new ReferenceError('unwrapErr() called on an Ok Result');

		return this.#value as E;
	}

	try(): T | never {
		if (!this.#isValue)
			throw new ReferenceError((this.#value as E extends string ? E : never));

		return this.#value as T;
	}

	isValue(): boolean {
		return this.#isValue;
	}

	isError(): boolean {
		return !this.#isValue;
	}

	map<T2>(mapper: (value: T) => T2): Result<T2, E> {
		if (this.#isValue)
			return Result.ok(mapper(this.#value as T));
		else
			return this as unknown as Result<T2, E>;
	}

	async awaitMap<T2, P extends Promise<T2>>(mapper: (value: T) => P): Future<T2, E> {
		if (this.#isValue)
			return Result.ok(await mapper(this.#value as T));
		else
			return this as unknown as Result<T2, E>;
	}
}

export function Ok<T>(value: T): Result<T, never>;
export function Ok(): Result<undefined, never>;
export function Ok<T>(...args: T[]): Result<T, never> {
	return Result.ok(args[0]);
}

export function Err<E>(error: E): Result<never, E> {
	return Result.err(error);
}

export type Future<T = undefined, E = string> = Promise<Result<T, E>>;
