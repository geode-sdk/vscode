import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ColorThemeKind, ExtensionContext, OutputChannel, window, workspace, WorkspaceConfiguration } from "vscode";
import { Err, Ok, Option, Result } from "./utils/monads";
import { ResourceDatabase, UserSaveData } from "./project/resources/ResourceDatabase";

let EXTENSION: ExtensionContext;
let CHANNEL: OutputChannel;

export function getSaveDataPath(): string {
	return join(EXTENSION.globalStorageUri.fsPath, "data.json");
}

export function saveData(): Result {
	try {
		// Create save directory if it doesn't exist yet
		if (!existsSync(EXTENSION.globalStorageUri.fsPath)) {
			mkdirSync(EXTENSION.globalStorageUri.fsPath);
		}

		const data = ResourceDatabase.get().saveUserOptions();

		// Save data
		writeFileSync(getSaveDataPath(), JSON.stringify(data));
		return Ok();
	} catch (err) {
		return Err(`${err}`);
	}
}

export function loadData(): Result {
	if (!existsSync(getSaveDataPath())) {
		return Ok();
	}
	try {
		ResourceDatabase.get().loadUserOptions(JSON.parse(
			readFileSync(getSaveDataPath()).toString()
		) as UserSaveData);
		return Ok();
	} catch (err) {
		return Err(err as string);
	}
}

export function getExtConfig(): WorkspaceConfiguration {
	return workspace.getConfiguration("geode");
}

export function getExtContext(): ExtensionContext {
	return EXTENSION;
}

export function getOutputChannel(): OutputChannel {
	return CHANNEL;
}

export function setupConfig(
	extension: ExtensionContext,
	channel: OutputChannel,
) {
	EXTENSION = extension;
	CHANNEL = channel;
}

export function getAsset(name?: string): string {
	if (name) {
		if (name.includes("{theme}")) {
			name = name.replace(
				"{theme}",
				window.activeColorTheme.kind === ColorThemeKind.Dark
					? "dark"
					: "light",
			);
		}
		return join(getExtContext().extension.extensionPath, `assets/${name}`);
	} else {
		return "";
	}
}

export function getWorkspaceDir(): Option<string> {
    return workspace.workspaceFolders?.[0]?.uri.fsPath;
}