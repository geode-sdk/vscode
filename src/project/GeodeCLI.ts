import { execSync } from "child_process";
import { existsSync, readFileSync, unwatchFile, watchFile } from "fs";
import { join, dirname } from "path";
import { ConfigurationTarget, Terminal, Uri, window } from "vscode";
import { getAsset, getExtConfig, getOutputChannel } from "../config";
import { Option, Future, Err, Ok, Result } from "../utils/monads";
import { clean, gte } from "semver";

export interface Config {
    readonly currentProfile: string;
    readonly profiles: Profile[];
    readonly defaultDeveloperName?: string;
    readonly sdkNightly?: boolean;
    readonly indexToken?: string;
    readonly indexUrl: string;
}

export class Profile {

    private readonly name: string;

    private readonly executablePath: string;

    private readonly directory: string;

    constructor(name: string, executablePath: string) {
        this.name = name;
        this.executablePath = executablePath;
        this.directory = dirname(executablePath);
    }

    public getName(): string {
        return this.name;
    }

    public getExecutablePath(): string {
        return this.executablePath;
    }

    public getDirectory(): string {
        return this.directory;
    }
}

export class GeodeCLI {

    private static readonly MINIMUM_SUPPORTED_VERSION = "3.5.0";

    private static SHARED_STATE?: GeodeCLI;

    public static get(): Option<GeodeCLI> {
        return GeodeCLI.SHARED_STATE;
    }

    public static async setup(): Future<GeodeCLI> {
        const outputChannel = getOutputChannel();

        outputChannel.appendLine("Checking Geode CLI...");

        const path = GeodeCLI.getCliPath();
        const reportedVersion = GeodeCLI.runProgram(path, "--version");

        if (reportedVersion.isError()) {
            outputChannel.appendLine(`Unable to check Geode CLI version: ${reportedVersion}`);

            return Err(`Unable to check Geode CLI version: ${reportedVersion}`);
        }

        const version = clean(reportedVersion.unwrap().replace("geode", "")) ?? "";

        if (!gte(version, GeodeCLI.MINIMUM_SUPPORTED_VERSION)) {
            return Err(`CLI Version '${version}' is too old, Geode extension requires at least ${GeodeCLI.MINIMUM_SUPPORTED_VERSION}`);
        }

        const configFile = join(GeodeCLI.configPlatformPath(), "config.json");

        if (!existsSync(configFile)) {
            return Err("Unable to find CLI config.json! Have you run `geode config setup`?");
        }

        outputChannel.appendLine(`Found Geode CLI: ${path} (${version})`);

        try {
            return Ok(GeodeCLI.SHARED_STATE = new GeodeCLI(path, version, configFile));
        } catch (error) {
            return Err((error as Error).message);
        }
    }

    private static getCliPath(): string {
        const config = getExtConfig();
        const savedPath = config.get<string>("geodeCliPath");

        if (savedPath && existsSync(savedPath)) {
            return savedPath;
        }

        // Try to auto-detect path if the user hasn't provided it by iterating 
        // the environment PATH and checking if the CLI executable can be found 
        // in any of the directories
        if (process.env["PATH"]) {
            const path = process.env["PATH"].split(";")
                .map((pathPart) => join(pathPart, this.cliPlatformName()))
                .find((cliPath) => existsSync(cliPath));

            if (path) {
                config.update("geodeCliPath", path, ConfigurationTarget.Global);

                return path;
            } else {
                getOutputChannel().appendLine("Unable to detect Geode CLI path");
            }
        }

        throw new Error("Unable to automatically detect Geode CLI path! Please set the path in Geode settings.");
    }

    private static cliPlatformName(): string {
        if (process.platform == "win32") {
            return "geode.exe";
        } else {
            return "geode";
        }
    }

    private static configPlatformPath(): string {
        if (process.platform == "win32") {
            return join(process.env["LOCALAPPDATA"] as string, "Geode");
        } else if (process.platform == "linux") {
            return join(process.env.HOME as string, ".local/share/Geode");
        } else {
            return "/Users/Shared/Geode";
        }
    }

    private static runProgram(path: string, cmd: string, cwd?: string): Result<string, string> {
        try {
            return Ok(execSync(`"${path}" ${cmd}`, { encoding: "utf-8", cwd }));
        } catch (error) {
            return Err((error as Error).message);
        }
    }

    private readonly installedPath: string;

    private readonly version: string;

    private readonly configPath: string;

    private readonly updateEvents: Map<number, (config: Config) => any>;

    private readonly terminalEvents: Map<number, (terminal?: Terminal) => any>;

    private config: Config;

    private eventID: number;

    private gdTerminal?: Terminal;

    private constructor(path: string, version: string, configPath: string) {
        this.installedPath = path;
        this.version = version;
        this.configPath = configPath;
        this.updateEvents = new Map();
        this.terminalEvents = new Map();
        this.eventID = 0;

        const config = this.fetchConfig();

        if (config.isError()) {
            throw new Error(`Unable to parse Geode CLI config: ${config.unwrapErr()}`);
        } else {
            this.config = config.unwrap();
        }
    }

    public getPath(): string {
        return this.installedPath;
    }

    public getVersion(): string {
        return this.version;
    }

    public getConfig(): Config {
        return this.config;
    }

    public onUpdateEvent(callback: (config: Config) => any): number {
        const id = this.eventID++;

        this.updateEvents.set(id, callback);

        if (this.updateEvents.size == 1) {
            watchFile(this.configPath, () => this.updateConfig());
        }

        return id;
    }

    public removeUpdateWatch(id: number): void {
        this.updateEvents.delete(id);

        if (this.updateEvents.size == 0) {
            unwatchFile(this.configPath);
        }
    }

    public onTerminalEvent(callback: (terminal?: Terminal) => any): number {
        const id = this.eventID++;

        this.terminalEvents.set(id, callback);

        return id;
    }

    public removeTerminalWatch(id: number): void {
        this.terminalEvents.delete(id);
    }

    public getProfileForName(name: string): Option<Profile> {
        this.updateConfig();

        return this.config.profiles.find((profile) => profile.getName() == name);
    }

    public getCurrentProfile(): Option<Profile> {
        this.updateConfig();

        return this.getProfileForName(this.config.currentProfile);
    }

    public setCurrentProfile(profile: string): Result<Profile, string> {
        const foundProfile = this.getProfileForName(profile);

        if (foundProfile) {
            const result = this.run(`profile switch ${foundProfile.getName()}`);

            this.updateConfig();

            return result.isValue() ? Ok(foundProfile) : Err(result.unwrapErr());
        } else {
            return Err(`Profile '${profile}' not found!`);
        }
    }

    public removeProfile(profile: string): Result<Profile, string> {
        const foundProfile = this.getProfileForName(profile);

        if (foundProfile) {
            const result = this.run(`profile remove ${foundProfile.getName()}`);

            this.updateConfig();

            return result.isValue() ? Ok(foundProfile) : Err(result.unwrapErr());
        } else {
            return Err(`Profile '${profile}' not found!`);
        }
    }

    public async launchProfile(profile: string = this.config.currentProfile): Future {
        const foundProfile = this.setCurrentProfile(profile);

        if (foundProfile.isError()) {
            return Err(foundProfile.unwrapErr());
        }

        try {
            // close the terminal if one is already open
            this.destroyTerminal();

            // SAFETY: GeodeCLI must exist for a Profile to exist
            // The only case in which the null assertion doesn't hold is if 
            // somehow something is holding a reference to a Profile while the 
            // user goes an uninstalls CLI, which is extremely unlikely
            // and solved via restart
            this.gdTerminal = window.createTerminal({
                name: "Geometry Dash",
                cwd: foundProfile.unwrap().getDirectory(),
                shellPath: GeodeCLI.get()!.getPath(),
                shellArgs: [ "run", "--stay" ],
                iconPath: {
                    dark: Uri.file(getAsset("blockman-dark.svg")),
                    light: Uri.file(getAsset("blockman-light.svg"))
                }
            });

            this.gdTerminal.show();
            this.terminalEvents.forEach((event) => event(this.gdTerminal));

            return Ok();
        } catch (error) {
            return Err((error as Error).message);
        }
    }

    public destroyTerminal(): void {
        if (this.gdTerminal) {
            this.gdTerminal.dispose();
            this.terminalEvents.forEach((event) => event(undefined));

            this.gdTerminal = undefined;
        }
    }

    public getActiveTerminal(): Option<Terminal> {
        return this.gdTerminal;
    }

    public hasActiveTerminal(): boolean {
        return this.gdTerminal != undefined;
    }

    private run(cmd: string, cwd?: string): Result<string, string> {
        getOutputChannel().appendLine(`Running command \`geode ${cmd}\``);

        return GeodeCLI.runProgram(this.installedPath, cmd, cwd);
    }

    private fetchConfig(): Result<Config, string> {
        try {
            const configData = JSON.parse(readFileSync(this.configPath, "utf8"));

            return Ok({
                currentProfile: configData["current-profile"],
                profiles: (configData["profiles"] as any[]).map((profile) => new Profile(profile["name"], profile["gd-path"])),
                defaultDeveloperName: configData["default-developer"],
                sdkNightly: configData["sdk-nightly"],
                indexToken: configData["index-token"],
                indexUrl: configData["index-url"]
            });
        } catch (error) {
            return Err(`Unable to parse CLI config.json! Try running \`geode config setup\`, or manually fixing your config file (error: ${error})`);
        }
    }

    private updateConfig(): void {
        const config = this.fetchConfig();

        // When will you learn, when will you learn, that your actions have consequences?
        if (config.isError()) {
            return getOutputChannel().appendLine(`Unable to update Geode CLI config: ${config.unwrapErr()}`);
        }

        this.config = config.unwrap();
        this.updateEvents.forEach((event) => event(this.config));
    }
}
