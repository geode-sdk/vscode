import { readdirSync } from "fs";
import { join } from "path";
import { Uri, Webview } from "vscode";
import { getExtContext } from "../config";

export function readdirRecursiveSync(dir: string) {
	let res: string[] = [];

	readdirSync(dir, { withFileTypes: true }).forEach((file) => {
		if (file.isDirectory()) {
			res = res.concat(readdirRecursiveSync(join(dir, file.name)));
		} else {
			res.push(join(dir, file.name));
		}
	});

	return res;
}

export function getWebviewUri(webview: Webview, pathList: string[]) {
	return webview.asWebviewUri(
		Uri.joinPath(getExtContext().extensionUri, ...pathList),
	);
}

export function getWebviewToolkitPath(webview: Webview) {
	return getWebviewUri(webview, [
		"node_modules/@vscode/webview-ui-toolkit/dist/toolkit.min.js",
	]);
}

export function importWebviewToolkit(webview: Webview) {
	return /*html*/ `
        <script type="module" src="${getWebviewToolkitPath(webview)}"></script>
    `;
}

export function getCodiconToolkitPath(webview: Webview) {
	return getWebviewUri(webview, [
		"node_modules/@vscode/codicons/dist/codicon.css",
	]);
}

export function importCodiconToolkit(webview: Webview) {
	return /*html*/ `
        <link href="${getCodiconToolkitPath(webview)}" rel="stylesheet" />
    `;
}

export function removeFromArray<T>(array: T[], item: T) {
	if (array.includes(item)) {
		array.splice(array.indexOf(item), 1);
	}
}

export function clamp(start: number, num: number, end: number): number {
	if (num < start) {
		return num;
	}
	if (num > end) {
		return end;
	}
	return num;
}
