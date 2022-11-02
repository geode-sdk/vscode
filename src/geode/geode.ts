
export * from './cli';
export * from './sdk';
export * from './gd';

import { cli } from './cli';
import { sdk } from './sdk';
import { Future, Err, Ok } from '../utils/monads';

export async function setup(): Future<undefined, string> {
    // auto-find Geode CLI
    const cliRes = await cli.setup();
    if (cliRes.isError()) {
        return Err(cliRes.unwrapErr());
    }

    // auto-find Geode SDK
    const sdkRes = await sdk.setup();
    if (sdkRes.isError()) {
        return Err(sdkRes.unwrapErr());
    }

    return Ok();
}
