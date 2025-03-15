import {
	window,
	ExtensionContext,
	commands,
	languages,
} from "vscode";
import { getOutputChannel, loadData, saveData, setupConfig } from "./config";
import { CCColor3bProvider, CCColor4bProvider } from "./providers/color";
import { SpriteHoverPreview } from "./providers/hover";
import { registerLinters } from "./providers/lint";
import { ModifyClassMethodCompletion } from "./providers/suggest";
import { ModJsonSuggestionsProvider } from "./project/ModJson";
import { GeodeSDK } from "./project/GeodeSDK";
import { GeodeCLI } from "./project/GeodeCLI";
import { ResourceDatabase } from "./project/resources/ResourceDatabase";
import { SpriteBrowserPanel } from "./ui/SpriteBrowser";
import { Project, ProjectDatabase } from "./project/Project";

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

	// setup SDK
	const resSdk = await GeodeSDK.setup();
	if (resSdk.isError()) {
		window.showErrorMessage(
			`Geode: Unable to setup Geode extension: ${resSdk.unwrapErr()}`,
		);
		return;
	}

	// setup SDK
	const resCLI = await GeodeCLI.setup();
	if (resCLI.isError()) {
		window.showErrorMessage(
			`Geode: Unable to setup Geode extension: ${resCLI.unwrapErr()}`,
		);
		return;
	}

	const resProjects = await ProjectDatabase.get().setup(context);
	if (resProjects.isError()) {
		window.showErrorMessage(
			`Geode: Unable to setup Geode extension: ${resProjects.unwrapErr()}`,
		);
		return;
	}

	// setup sprite browser
	const resBrowser = await ResourceDatabase.get().setup();
	if (resBrowser.isError()) {
		window.showErrorMessage(
			`Geode: Unable to setup Geode extension: ${resBrowser.unwrapErr()}`,
		);
		return;
	}

	// Register commands
	context.subscriptions.push(
		commands.registerCommand("geode.launchGD", async () => {
			channel.appendLine("Launching Geometry Dash...");
			const cli = GeodeCLI.get();
			if (!cli) {
				window.showErrorMessage("Unable to launch GD: Geode CLI not found!");
				return;
			}
			const profile = cli.getCurrentProfile();
			if (!profile) {
				window.showErrorMessage("Unable to launch GD: Geode CLI does not have a selected profile!");
				return;
			}
			const res = await profile.launch();
			if (res.isError()) {
				window.showErrorMessage(`Unable to launch GD: ${res.unwrapErr()}`);
			}
		}),
	);
	context.subscriptions.push(
		commands.registerCommand("geode.openSpriteBrowser", async () => {
			SpriteBrowserPanel.show();
		}),
	);
	// context.subscriptions.push(commands.registerCommand('geode.openDevTools', async () => {
	// 	DevToolsPanel.show();
	// }));

	// Register providers
	context.subscriptions.push(
		languages.registerColorProvider({ language: "cpp" }, new CCColor3bProvider())
	);
	context.subscriptions.push(
		languages.registerColorProvider({ language: "cpp" }, new CCColor4bProvider())
	);
	context.subscriptions.push(
		languages.registerHoverProvider({ language: "cpp" }, new SpriteHoverPreview())
	);
	context.subscriptions.push(
		languages.registerCompletionItemProvider({ language: "cpp" }, new ModifyClassMethodCompletion())
	);
	context.subscriptions.push(
		languages.registerCodeActionsProvider({ pattern: "**/mod.json" }, new ModJsonSuggestionsProvider())
	);
	registerLinters(context);
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
