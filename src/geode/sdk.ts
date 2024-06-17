import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigurationTarget } from 'vscode';
import * as semver from 'semver';
import { getExtConfig, getOutputChannel } from '../config';
import type { Future, Option, Result } from '../utils/monads';
import { Err, Ok, Some } from '../utils/monads';

export const MINIMUM_SDK_VERSION = 'v1.0.0-beta.5';
let INSTALLED_VERSION: string;

function autoDetectSDK(): Option<string> {
	return Some(process.env.GEODE_SDK);
}

function verifyVersion(): Result {
	try {
		const sdkVersion = readFileSync(join(getSDKPath(), 'VERSION')).toString();
		if (!semver.gte(sdkVersion, MINIMUM_SDK_VERSION))
			return Err(`SDK Version '${sdkVersion}' is too old, Geode extension requires at least '${MINIMUM_SDK_VERSION}'`);

		INSTALLED_VERSION = sdkVersion;
	}
	catch (e) {
		return Err(`Unable to query SDK version: ${(e as Error)}. Try manually specifying SDK path in extension settings`);
	}

	return Ok();
}

export function getSDKVersion(): string {
	return INSTALLED_VERSION;
}

export function hasSDK(): boolean {
	const path = getExtConfig().get<string>('geodeSdkPath');
	return path ? existsSync(path) : false;
}

export function getSDKPath(): string {
	return getExtConfig().get<string>('geodeSdkPath') ?? '';
}

export async function setup(): Future {
	if (!hasSDK()) {
		getOutputChannel().appendLine('Detecting SDK path');
		const path = autoDetectSDK();
		if (path) {
			getOutputChannel().appendLine(`Found SDK: ${path}`);
			await getExtConfig().update(
				'geodeSdkPath',
				path,
				ConfigurationTarget.Global,
			);
		}
		else {
			return Err(
				'Unable to automatically detect Geode SDK path! '
				+ 'Please set the path in Geode settings.',
			);
		}
	}

	const verify = verifyVersion();
	if (verify.isError())
		return verify;

	getOutputChannel().appendLine(`Found SDK: ${getExtConfig().get('geodeSdkPath')} v${getSDKVersion()}`);

	return Ok();
}
