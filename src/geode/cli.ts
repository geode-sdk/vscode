import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { ConfigurationTarget } from "vscode";
import { getExtConfig, getOutputChannel } from "../config";
import { Option, None, Some, Result, Future, Err, Ok } from "../utils/monads";
import * as semver from "semver";
import { getActiveProject } from "../project/project";

export namespace cli {
	export const MINIMUM_CLI_VERSION = "v2.5.0";
	let INSTALLED_VERSION: string;
	let CONFIG: Config;

	export interface Profile {
		name: string;
		gdPath: string;
		gdExecutablePath: string;
	}

	export interface Config {
		currentProfile: string;
		profiles: Profile[];
		defaultDeveloper?: string;
		sdkNightly?: boolean;
	}

	function cliPlatformName(): string {
		if (process.platform === "win32") {
			return "geode.exe";
		} else {
			return "geode";
		}
	}

	function configPlatformPath(): string {
		if (process.platform === "win32") {
			return join(process.env["LOCALAPPDATA"] as string, "Geode");
		} else if (process.platform === "linux") {
			return join(process.env.HOME as string, ".local/share/Geode");
		} else {
			return "/Users/Shared/Geode";
		}
	}

	function autoDetectCLI(): Option<string> {
		const PATH = process.env["PATH"];
		if (!PATH) {
			return None;
		}
		for (let path of PATH.split(";")) {
			const cliPath = join(path, cliPlatformName());
			if (existsSync(cliPath)) {
				return Some(cliPath);
			}
		}
		return None;
	}

	function verifyVersion(): Result {
		const versionRes = runCLICmd("--version");
		if (versionRes.isError()) {
			getOutputChannel().appendLine(`Error ${versionRes.unwrapErr()}`);
			return Err(versionRes.unwrapErr());
		}
		const version =
			semver.clean(versionRes.unwrap().replace("geode", "")) ?? "";
		if (!semver.gte(version, MINIMUM_CLI_VERSION)) {
			return Err(
				`CLI Version '${version}' is too old, ` +
					`Geode extension requires at least '${MINIMUM_CLI_VERSION}'`,
			);
		}
		INSTALLED_VERSION = version;

		return Ok();
	}

	function loadConfig(): Result {
		const configFile = join(configPlatformPath(), "config.json");
		if (!existsSync(configFile)) {
			return Err("Unable to find CLI config.json!");
		}
		CONFIG = JSON.parse(readFileSync(configFile).toString(), (_, value) => {
			if (value && typeof value === "object") {
				for (const k in value) {
					const camelKey = k.replace(/-./g, (c) =>
						c.toUpperCase().substring(1),
					);
					if (camelKey !== k) {
						value[camelKey] = value[k];
						delete value[k];
					}
				}
			}
			return value;
		});
		// Since CLI 2.5.0, gd-path points to the gd executable instead of the gd folder.
		CONFIG.profiles = CONFIG.profiles.map((prof) => ({
			name: prof.name,
			gdExecutablePath: prof.gdPath,
			gdPath: dirname(prof.gdPath),
		}));
		return Ok();
	}

	export function getConfig(): Config {
		return CONFIG;
	}

	export function getCurrentProfile(): Option<Profile> {
		return Some(
			CONFIG.profiles.find((p) => p.name === CONFIG.currentProfile),
		);
	}

	export function getVersion(): string {
		return INSTALLED_VERSION;
	}

	export function runCLICmd(cmd: string): Result<string> {
		try {
			getOutputChannel().appendLine(`Running command \`geode ${cmd}\``);
			return Ok(
				execSync(`"${getCLIPath()}" ${cmd}`, { encoding: "utf-8" }),
			);
		} catch (e) {
			return Err((e as Error).message);
		}
	}

	export function runCLICmdInProject(cmd: string): Result<string> {
		try {
			getOutputChannel().appendLine(`Running command \`geode ${cmd}\``);
			const project = getActiveProject();
			if (!project) {
				return Err(
					"No mod project is open - running this command requires you to be in a mod project!",
				);
			}
			return Ok(
				execSync(`"${getCLIPath()}" ${cmd}`, {
					encoding: "utf-8",
					cwd: project.path,
				}),
			);
		} catch (e) {
			return Err((e as Error).message);
		}
	}

	export function hasCLI(): boolean {
		const path = getExtConfig().get<string>("geodeCliPath");
		return path ? existsSync(path) : false;
	}

	export function getCLIPath(): string {
		return getExtConfig().get<string>("geodeCliPath") ?? "";
	}

	export async function setup(): Future {
		// auto-find Geode CLI
		if (!hasCLI()) {
			getOutputChannel().appendLine("Detecting CLI path");
			const path = autoDetectCLI();
			if (path) {
				await getExtConfig().update(
					"geodeCliPath",
					path,
					ConfigurationTarget.Global,
				);
			} else {
				return Err(
					"Unable to automatically detect Geode CLI path! " +
						"Please set the path in Geode settings.",
				);
			}
		}

		const verify = verifyVersion();
		if (verify.isError()) {
			return verify;
		}

		const conf = loadConfig();
		if (conf.isError()) {
			return conf;
		}

		getOutputChannel().appendLine(
			`Found CLI: ${getExtConfig().get("geodeCliPath")} v${INSTALLED_VERSION}`,
		);

		return Ok();
	}
}
