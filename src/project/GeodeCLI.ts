import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { ConfigurationTarget, Terminal, window } from "vscode";
import { getExtConfig, getOutputChannel } from "../config";
import { Option, None, Some, Future, Err, Ok } from "../utils/monads";
import * as semver from "semver";

export class Profile {
	#name: string;
	#executablePath: string;
	#directoryPath: string;
	#gdLaunchTerminal: Terminal | undefined;

	constructor(name: string, executablePath: string) {
		this.#name = name;
		this.#executablePath = executablePath;
		this.#directoryPath = dirname(executablePath);
	}

	public async launch(): Future {
		try {
			// close the terminal if one is already open
			if (this.#gdLaunchTerminal) {
				this.#gdLaunchTerminal.dispose();
			}
			// SAFETY: GeodeCLI must exist for a Profile to exist
			// The only case in which the null assertion doesn't hold is if 
			// somehow something is holding a reference to a Profile while the 
			// user goes an uninstalls CLI, which is extremely unlikely
			// and solved via restart
			this.#gdLaunchTerminal = window.createTerminal("Geometry Dash", GeodeCLI.get()!.getPath(), ["run", "--stay"]);
			this.#gdLaunchTerminal.show();
			return Ok();
		}
		catch (e) {
			return Err((e as Error).message);
		}
	}

	public getName(): string {
		return this.#name;
	}
	public getExecutablePath(): string {
		return this.#executablePath;
	}
	public getDirectory(): string {
		return this.#directoryPath;
	}
}

export interface Config {
	currentProfile: string;
	profiles: Profile[];
	defaultDeveloperName?: string;
	sdkNightly?: boolean;
	indexToken?: string;
}

export class GeodeCLI {
	#installedPath: string;
	#version: string;
	#config: Config;
	static #sharedState: Option<GeodeCLI> = None;

	private constructor(path: string, version: string, config: Config) {
		this.#installedPath = path;
		this.#version = version;
		this.#config = config;
	}

	private static cliPlatformName(): string {
		if (process.platform === "win32") {
			return "geode.exe";
		}
		else {
			return "geode";
		}
	}
	private static configPlatformPath(): string {
		if (process.platform === "win32") {
			return join(process.env["LOCALAPPDATA"] as string, "Geode");
		}
		else if (process.platform === "linux") {
			return join(process.env.HOME as string, ".local/share/Geode");
		}
		else {
			return "/Users/Shared/Geode";
		}
	}
	private static runProgram(path: string, cmd: string, cwd?: string) {
		try {
			return Ok(execSync(`"${path}" ${cmd}`, { encoding: "utf-8", cwd }));
		}
		catch (e) {
			return Err((e as Error).message);
		}
	}

	public static async setup(): Future<GeodeCLI> {
		this.#sharedState = None;
		
		getOutputChannel().appendLine("Checking Geode CLI...");

		let path = getExtConfig().get<string>("geodeCliPath");

		// Try to auto-detect path if the user hasn't provided it by iterating 
		// the environment PATH and checking if the CLI executable can be found 
		// in any of the directories
		if (!path) {
			const PATH = process.env["PATH"];
			if (PATH) {
				for (let path of PATH.split(";")) {
					const cliPath = join(path, this.cliPlatformName());
					if (existsSync(cliPath)) {
						// If we found the path, save it for future reference
						path = cliPath;
						await getExtConfig().update("geodeCliPath", path, ConfigurationTarget.Global);
						break;
					}
				}
			}
			if (!path) {
				getOutputChannel().appendLine("Unable to detect Geode CLI path");
				return Err(
					"Unable to automatically detect Geode CLI path! " +
						"Please set the path in Geode settings."
				);
			}
		}


		const reportedVersion = this.runProgram(path, "--version");;
		if (reportedVersion.isError()) {
			getOutputChannel().appendLine(`Unable to check Geode CLI version: ${reportedVersion}`);
			return Err(`Unable to check Geode CLI version: ${reportedVersion}`);
		}
		const version = semver.clean(reportedVersion.unwrap().replace("geode", "")) ?? "";
		if (!semver.gte(version, this.getMinimumSupportedVersion())) {
			return Err(
				`CLI Version '${version}' is too old, ` +
					`Geode extension requires at least '${this.getMinimumSupportedVersion()}'`,
			);
		}

		const configFile = join(this.configPlatformPath(), "config.json");
		if (!existsSync(configFile)) {
			return Err("Unable to find CLI config.json! Have you run `geode config setup`?");
		}
		try {
			const configData = JSON.parse(readFileSync(configFile).toString());
			const config = {
				currentProfile: configData["current-profile"],
				profiles: (configData["profiles"] as any[]).map(v => {
					return new Profile(v["name"], v["gd-path"]);
				}),
				defaultDeveloperName: configData["default-developer"],
				sdkNightly: configData["sdk-nightly"],
				indexToken: configData["index-token"],
			};
			this.#sharedState = new GeodeCLI(path, version, config);
			getOutputChannel().appendLine(`Found Geode CLI: ${path} (${version})`,);
		}
		catch (e) {
			return Err(
				"Unable to parse CLI config.json! Try running `geode config setup`, " + 
					`or manually fixing your config file (error: ${e})`
			);
		}

		return Ok(this.#sharedState);
	}
	public static get(): Option<GeodeCLI> {
		return this.#sharedState;
	}
	public static getMinimumSupportedVersion(): string {
		return "3.5.0";
	}

	public run(cmd: string, cwd?: string) {
		getOutputChannel().appendLine(`Running command \`geode ${cmd}\``);
		return GeodeCLI.runProgram(this.#installedPath, cmd, cwd);
	}

	public getPath(): string {
		return this.#installedPath;
	}
	public getVersion(): string {
		return this.#version;
	}
	public getConfig(): Config {
		return this.#config;
	}
	public getCurrentProfile(): Option<Profile> {
		return Some(this.#config.profiles.find((p) => p.getName() === this.#config.currentProfile));
	}
}
