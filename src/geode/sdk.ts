
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ConfigurationTarget, window } from 'vscode';
import { getExtConfig, getOutputChannel } from '../config';
import { Option, Some, Result, Future, Err, Ok } from '../utils/monads';
import * as semver from 'semver';

export namespace sdk {
    export const MINIMUM_SDK_VERSION = 'v0.6.0';
    let INSTALLED_VERSION: string;

    function autoDetectSDK(): Option<string> {
        return Some(process.env['GEODE_SDK']);
    }

    function verifyVersion(): Result {
        try {
            const sdkVersion = readFileSync(join(getSDKPath(), 'VERSION')).toString();
            if (!semver.gte(sdkVersion, MINIMUM_SDK_VERSION)) {
                return Err(
                    `SDK Version '${sdkVersion}' is too old, ` + 
                    `Geode extension requires at least '${MINIMUM_SDK_VERSION}'`
                );
            }
            INSTALLED_VERSION = sdkVersion;
        } catch(e) {
            return Err(`Unable to query SDK version: ${(e as Error)}`);
        }

        return Ok();
    }

    export function getVersion(): string {
        return INSTALLED_VERSION;
    }

    export function hasSDK(): boolean {
        const path = getExtConfig().get<string>('geodeCliPath');
        return path ? existsSync(path) : false;
    }

    export function getSDKPath(): string {
        return getExtConfig().get<string>('geodeSdkPath', ) ?? '';
    }

    export async function setup(): Future {
        if (!hasSDK()) {
            getOutputChannel().appendLine('Detecting SDK path');
            const path = autoDetectSDK();
            if (path) {
                getOutputChannel().appendLine(`Found SDK: ${path}`);
                await getExtConfig().update(
                    'geodeSdkPath', path,
                    ConfigurationTarget.Global
                );
            } else {
                return Err(
                    'Unable to automatically detect Geode SDK path! ' + 
                    'Please set the path in Geode settings.'
                );
            }
        }

        const verify = verifyVersion();
        if (verify.isError()) {
            return verify;
        }

        getOutputChannel().appendLine(
            `Found SDK: ${getExtConfig().get('geodeSdkPath')} v${getVersion()}`
        );

        return Ok();
    }
}
