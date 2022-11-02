
import { ExtensionContext, OutputChannel, workspace } from "vscode";

let EXTENSION: ExtensionContext;
let CHANNEL: OutputChannel;

export function getExtConfig() {
    return workspace.getConfiguration('geode');
}

export function getExtContext() {
    return EXTENSION;
}

export function getOutputChannel() {
    return CHANNEL;
}

export function setupConfig(extension: ExtensionContext, channel: OutputChannel) {
    EXTENSION = extension;
    CHANNEL = channel;
}
