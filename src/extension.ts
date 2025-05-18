import {
	window,
	ExtensionContext,
	commands,
	languages,
} from "vscode";
import { loadData, saveData, setupConfig } from "./config";
import { CCColor3bProvider, CCColor4bProvider } from "./providers/color";
import { SpriteHoverPreview } from "./providers/hover";
import { registerLinters } from "./providers/lint";
import { ModifyClassMethodCompletion } from "./providers/suggest";
import { ModJsonSuggestionsProvider } from "./project/ModJson";
import { GeodeSDK } from "./project/GeodeSDK";
import { GeodeCLI } from "./project/GeodeCLI";
import { ResourceDatabase } from "./project/resources/ResourceDatabase";
import { ProjectDatabase } from "./project/Project";
import { DocsBrowser } from "./view/ui/DocsBrowser";
import { SpriteBrowser } from "./view/ui/SpriteBrowser";

export async function activate(context: ExtensionContext) {
	const channel = window.createOutputChannel("Geode");
    const viewOptions: Parameters<typeof window["registerWebviewViewProvider"]>[2] = {
        webviewOptions: {
            retainContextWhenHidden: true,
        }
    };

	// Store globals
	setupConfig(context, channel);

	// Setup SDK
	const resSdk = await GeodeSDK.setup();
	if (resSdk.isError()) {
		window.showErrorMessage(
			`Geode: Unable to setup Geode extension: ${resSdk.unwrapErr()}`,
		);
		return;
	}

	// Setup CLI
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

	//Ssetup sprite database
	const resBrowser = await ResourceDatabase.get().setup();
	if (resBrowser.isError()) {
		window.showErrorMessage(
			`Geode: Unable to setup Geode extension: ${resBrowser.unwrapErr()}`,
		);
		return;
	}

    // Load save data
	const resSave = loadData();
	if (resSave.isError()) {
		window.showErrorMessage(
			`Geode: Unable to load Geode extension save data: ${resSave.unwrapErr()}`,
		);
	}

    // Webview views
    context.subscriptions.push(
        window.registerWebviewViewProvider("geode-tools.docs-browser", new DocsBrowser(), viewOptions),
        window.registerWebviewViewProvider("geode-tools.sprite-browser", new SpriteBrowser(), viewOptions)
    );

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

	// Register providers
	context.subscriptions.push(
        languages.registerColorProvider({ language: "cpp" }, new CCColor3bProvider()),
        languages.registerColorProvider({ language: "cpp" }, new CCColor4bProvider()),
        languages.registerHoverProvider({ language: "cpp" }, new SpriteHoverPreview()),
        languages.registerCompletionItemProvider({ language: "cpp" }, new ModifyClassMethodCompletion()),
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
