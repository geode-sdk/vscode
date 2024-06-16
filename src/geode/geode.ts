import type { Future } from '../utils/monads';
import { Err, Ok } from '../utils/monads';
import { cli } from './cli';
import { sdk } from './sdk';

export * from './cli';
export * from './sdk';
export * from './ipc';
export * from './gd';

export async function setup(): Future {
	// auto-find Geode CLI
	const cliRes = await cli.setup();
	if (cliRes.isError())
		return Err(cliRes.unwrapErr());

	// auto-find Geode SDK
	const sdkRes = await sdk.setup();
	if (sdkRes.isError())
		return Err(sdkRes.unwrapErr());

	return Ok();
}
