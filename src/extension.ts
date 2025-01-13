import {
	window,
	ExtensionContext,
	commands,
	languages,
	CompletionItem,
	CompletionItemKind,
} from "vscode";
import { getOutputChannel, loadData, saveData, setupConfig } from "./config";
import * as geode from "./geode/geode";
import { browser } from "./browser/browser";
import { getOpenedProjects } from "./project/project";
import { CCColor3bProvider, CCColor4bProvider } from "./project/color";
import { SpriteHoverPreview } from "./project/hover";
import { registerLinters } from "./project/lint";
import { ModifyClassMethodCompletion } from "./project/suggest";

export async function activate(context: ExtensionContext) {
	const channel = window.createOutputChannel("Geode");

	// store globals
	setupConfig(context, channel);

	// load save data
	const res0 = loadData();
	if (res0.isError()) {
		window.showErrorMessage(
			`Geode: Unable to load Geode extension data: ${res0.unwrapErr()}`,
		);
	}

	// setup geode
	const res = await geode.setup();
	if (res.isError()) {
		window.showErrorMessage(
			`Geode: Unable to setup Geode extension: ${res.unwrapErr()}`,
		);
		return;
	}

	// setup sprite browser
	const res2 = browser.setup();
	if (res2.isError()) {
		window.showErrorMessage(
			`Geode: Unable to setup Geode extension: ${res.unwrapErr()}`,
		);
		return;
	}

	// register commands
	context.subscriptions.push(
		commands.registerCommand("geode.launchGD", async () => {
			channel.appendLine("Launching Geometry Dash...");
			const res = await geode.gd.launchGD();
			if (res.isError()) {
				window.showErrorMessage(
					`Unable to launch GD: ${res.unwrapErr()}`,
				);
			}
		}),
	);

	context.subscriptions.push(
		commands.registerCommand("geode.openSpriteBrowser", async () => {
			browser.open();
		}),
	);

	context.subscriptions.push(
		languages.registerColorProvider(
			{ language: "cpp" },
			new CCColor3bProvider(),
		),
	);
	context.subscriptions.push(
		languages.registerColorProvider(
			{ language: "cpp" },
			new CCColor4bProvider(),
		),
	);
	context.subscriptions.push(
		languages.registerHoverProvider(
			{ language: "cpp" },
			new SpriteHoverPreview(),
		),
	);
	context.subscriptions.push(
		languages.registerCompletionItemProvider(
			{ language: "cpp" },
			new ModifyClassMethodCompletion(),
		),
	);

	registerLinters(context);

	getOutputChannel().appendLine(
		`Open Geode projects: ${getOpenedProjects()
			.map((p) => p.modJson.id)
			.join(", ")}`,
	);

	// context.subscriptions.push(commands.registerCommand('geode.openDevTools', async () => {
	// 	DevToolsPanel.show();
	// }));
}

export async function deactivate() {
	// save extension data
	const res0 = saveData();
	if (res0.isError()) {
		window.showErrorMessage(
			`Geode: Unable to save Geode extension data: ${res0.unwrapErr()}`,
		);
	}
}
