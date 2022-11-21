
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ColorThemeKind, ExtensionContext, OutputChannel, window, workspace, WorkspaceConfiguration } from "vscode";
import { browser } from "./browser/browser";
import { ItemLocator, ItemType } from "./browser/item";
import { Err, Ok, Result } from "./utils/monads";

let EXTENSION: ExtensionContext;
let CHANNEL: OutputChannel;

interface SaveData {
    favorites: ItemLocator[],
}

export function getSaveDataPath(): string {
    return join(EXTENSION.globalStorageUri.fsPath, 'data.json');
}

export function saveData(): Result {
    try {
        // create save directory if it doesn't exist yet
        if (!existsSync(EXTENSION.globalStorageUri.fsPath)) {
            mkdirSync(EXTENSION.globalStorageUri.fsPath);
        }

        const data: SaveData = {
            favorites: browser.getDatabase().getFavorites(),
        };
        
        // save data
        writeFileSync(getSaveDataPath(), JSON.stringify(data));
        return Ok();
    } catch(err) {
        return Err(`${err}`);
    }
}

export function loadData(): Result {
    if (!existsSync(getSaveDataPath())) {
        return Ok();
    }
    try {
        const data = JSON.parse(
            readFileSync(getSaveDataPath()).toString()
        ) as SaveData;

        browser.getDatabase().loadFavorites(data.favorites);

        return Ok();
    } catch(err) {
        return Err(err as string);
    }
}

export function getExtConfig(): WorkspaceConfiguration {
    return workspace.getConfiguration('geode');
}

export function getExtContext(): ExtensionContext {
    return EXTENSION;
}

export function getOutputChannel(): OutputChannel {
    return CHANNEL;
}

export function setupConfig(extension: ExtensionContext, channel: OutputChannel) {
    EXTENSION = extension;
    CHANNEL = channel;
}

export function getAsset(name?: string): string {
    if (name) {
        if (name.includes('{theme}')) {
            name = name.replace('{theme}',
                window.activeColorTheme.kind === ColorThemeKind.Dark ? 'dark' : 'light'
            );
        }
        return join(getExtContext().extension.extensionPath, `assets/${name}`);
    } else {
        return '';
    }
}
