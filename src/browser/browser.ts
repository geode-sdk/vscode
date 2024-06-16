import { getOutputChannel } from '../config';
import type { Result } from '../utils/monads';
import { Ok } from '../utils/monads';
import { BrowserPanel } from './BrowserPanel';
import { Database } from './database';

// eslint-disable-next-line ts/no-namespace -- `Database` doesnt work in module declaration
export namespace browser {
	const DATABASE = new Database();

	export function refreshDatabase() {
		getOutputChannel().append('Loading sprites... ');
		DATABASE.refresh();
		getOutputChannel().appendLine(`done (loaded ${
            DATABASE.getCollectionById('all')?.getTotalCount()
        })`);
	}

	export function open() {
		BrowserPanel.show();
	}

	export function getDatabase() {
		return DATABASE;
	}

	export function setup(): Result {
		refreshDatabase();
		return Ok();
	}
}
