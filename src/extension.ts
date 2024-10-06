import {
	window,
	ExtensionContext,
	commands,
	languages,
    workspace,
} from "vscode";
import { getOutputChannel, loadData, saveData, setupConfig } from "./config";
import * as geode from "./geode/geode";
import { browser } from "./browser/browser";
import { execSync } from "child_process";
import { getActiveProject, getOpenedProjects } from "./project/project";
import { env } from "vscode";
import { Uri } from "vscode";
import { CCColor3bProvider, CCColor4bProvider } from "./project/color";
import { SpriteHoverPreview } from "./project/hover";
import { registerLinters } from "./project/lint";

export async function activate(context: ExtensionContext) {
    if ((await workspace.findFiles("mod.json")).length == 0) {
        return;
    }

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
		commands.registerCommand("geode.publishMod", async () => {
			const res = geode.cli.runCLICmdInProject(`project publish`);
			if (res.isError()) {
				window.showErrorMessage(
					`Unable to publish mod: ${res.unwrapErr()}`,
				);
				return;
			}
			const value = res.unwrap();
			getOutputChannel().append(value);
			// Check if unable to automatically push
			let pushCmd = value.match(/`git.*`/g)?.[0];
			pushCmd = pushCmd?.substring(1, pushCmd.length - 1);
			if (pushCmd) {
				try {
					getOutputChannel().appendLine(`Running ${pushCmd}`);
					execSync(pushCmd, {
						encoding: "utf-8",
						cwd: getActiveProject()?.path,
					});
				} catch (err) {
					window.showErrorMessage(`Syncing publish failed: ${err}`);
				}
			}
			let prURL = value.match(/https:\/\/.*?\.\.\.[a-zA-Z0-9]+/g)?.[0];
			if (!prURL) {
				window.showErrorMessage(
					`Unable to find Github pull request URL from command output - see output panel for details`,
				);
				getOutputChannel().append(value);
				getOutputChannel().show();
				return;
			}
			window
				.showInformationMessage(
					`To complete the publish, please open a Pull Request in your indexer: ${prURL}`,
					"Open URL",
				)
				.then((btn) => {
					if (btn === "Open URL" && prURL) {
						env.openExternal(Uri.parse(prURL));
					}
				});
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
