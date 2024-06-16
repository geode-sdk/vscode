import type { Terminal } from 'vscode';
import { window } from 'vscode';
import * as semver from 'semver';
import type { Future } from '../utils/monads';
import { Err, Ok } from '../utils/monads';
import { cli } from './cli';

// eslint-disable-next-line ts/no-namespace -- todo
export namespace gd {
	let terminal: undefined | Terminal;

	export async function launchGD(): Future {
		try {
			// close the terminal if one is already open
			if (terminal)
				terminal.dispose();

			terminal = window.createTerminal('Geometry Dash', cli.getCLIPath(), semver.gte(cli.getVersion(), 'v2.10.0') ? ['run', '--stay'] : ['run']);
			terminal.show();
			return Ok();
		}
		catch (e) {
			return Err((e as Error).message);
		}
	}
}
