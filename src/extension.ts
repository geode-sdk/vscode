
import { window, ExtensionContext, commands } from 'vscode';
import { setupConfig } from './config';
import * as geode from './geode/geode';

export async function activate(context: ExtensionContext) {
	const channel = window.createOutputChannel('Geode');
	
	// store globals
	setupConfig(context, channel);

	// setup geode
	const res = await geode.setup();
	if (res.isError()) {
		window.showErrorMessage(
			`Geode: Unable to setup Geode extension: ${res.unwrapErr()}`
		);
		return;
	}

	// register commands
	context.subscriptions.push(commands.registerCommand('geode.launchGD', async () => {
		channel.appendLine('Launching Geometry Dash...');
		const res = await geode.gd.launchGD();
		if (res.isError()) {
			window.showErrorMessage(`Unable to launch GD: ${res.unwrapErr()}`);
		}
	}));
}

export async function deactivate() {}
