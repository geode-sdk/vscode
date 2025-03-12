import { existsSync, readFileSync } from "fs";
import { join as pathJoin } from "path";
import { ConfigurationTarget, window } from "vscode";
import { getExtConfig, getOutputChannel } from "../config";
import { Option, Some, Result, Future, Err, Ok, None } from "../utils/monads";
import * as semver from "semver";
import { ModJson } from "./ModJson";
import { Project, ProjectDatabase } from "./Project";

export class GeodeSDK {
	#installedPath: string;
	#version: string;
	static #sharedState: Option<GeodeSDK> = None;

	private constructor(path: string, version: string) {
		this.#installedPath = path;
		this.#version = version;
	}

	public static async setup(): Future<GeodeSDK> {
		this.#sharedState = None;
		
		getOutputChannel().appendLine("Checking Geode SDK...");

		// Get the SDK path from extension settings
		let path = getExtConfig().get<string>("geodeSdkPath");

		// If no path has been set, try to guess from environment variables
		if (!path) {
			path = process.env["GEODE_SDK"];
			// If we succesfully detect it, then store that result for future reference
			if (path) {
				getOutputChannel().appendLine(`Detected Geode SDK path: ${path}`);
				await getExtConfig().update("geodeSdkPath", path, ConfigurationTarget.Global);
			}
			else {
				getOutputChannel().appendLine("Unable to detect Geode SDK path");
				return Err(
					"Unable to automatically detect Geode SDK path! " +
						"Please set the path in Geode settings."
				);
			}
		}

		// Verify that the found path contains a valid SDK
		if (!existsSync(pathJoin(path, "VERSION"))) {
			return Err(
				`Geode SDK installation seems to be broken (Path '${path}' does ` + 
					`not seem to point to Geode). ` + 
					"Try updating SDK path in extension settings"
			);
		}

		// Verify that the version of the SDK is valid
		try {
			const sdkVersion = readFileSync(pathJoin(path, "VERSION")).toString().trim();
			if (!semver.gte(sdkVersion, this.getMinimumSupportedVersion())) {
				return Err(
					`Geode SDK Version '${sdkVersion}' is too old, ` +
						`Geode extension requires at least '${this.getMinimumSupportedVersion()}'`,
				);
			}
			this.#sharedState = new GeodeSDK(path, sdkVersion);
			getOutputChannel().appendLine(`Found Geode SDK: ${path} (${sdkVersion})`);
		}
		catch (e) {
			return Err(
				`Geode SDK installation seems to be broken: ${e as Error}. ` +
					"Try manually specifying SDK path in extension settings"
			);
		}

		return Ok(this.#sharedState);
	}
	public static get(): Option<GeodeSDK> {
		return this.#sharedState;
	}
	public static getMinimumSupportedVersion(): string {
		return "4.2.0";
	}

	public getPath(): string {
		return this.#installedPath;
	}
	public getVersion(): string {
		return this.#version;
	}
	public getLoaderProject(): Option<Project> {
		return ProjectDatabase.get().loadProject(this.#installedPath);
	}
}
