import { getOutputChannel } from "../config";
import { Ok, Result } from "../utils/monads";
import { BrowserPanel } from "./BrowserPanel";
import { Database } from "./database";

export namespace browser {
	const DATABASE = new Database();

	export function refreshDatabase() {
		getOutputChannel().append("Loading sprites... ");
		DATABASE.refresh();
		getOutputChannel().appendLine(
			`done (loaded ${DATABASE.getCollectionById(
				"all",
			)?.getTotalCount()})`,
		);
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
