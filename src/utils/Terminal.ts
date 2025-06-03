import { ChildProcess, spawn } from "child_process";
import { Event, EventEmitter, ExtensionTerminalOptions, Pseudoterminal, Terminal, Uri, window } from "vscode";
import { getAsset } from "../config";

export interface PtyTerminalOptions {
    name?: string;
    path: string;
    cmd?: string[] | string;
    cwd?: string,
    // If true, the terminal has to be closed through user interaction
    userClosed?: boolean;
    icon?: ExtensionTerminalOptions["iconPath"];
    onWriteOut?: (data: string) => void;
    onWriteErr?: (data: string) => void;
    onProcessClose?: (code: number, output: string) => void;
    onTerminalClose?: (code: number, output: string) => void;
}

export class GeodeTerminal implements Pseudoterminal {

    public static open(options: PtyTerminalOptions): Terminal {
        return window.createTerminal({
            name: options.name ?? "Geode CLI",
            iconPath: options.icon ?? {
                light: Uri.file(getAsset("geode-light.svg")),
                dark: Uri.file(getAsset("geode-dark.svg"))
            },
            pty: new GeodeTerminal(options)
        });
    }

    private readonly options: PtyTerminalOptions;

    private readonly messageEmitter: EventEmitter<string>;

    private readonly closeEmitter: EventEmitter<number>;

    public readonly onDidWrite: Event<string>;

    public readonly onDidClose: Event<number>;

    private output: string;

    private process?: ChildProcess;

    private exitCode?: number;

    private constructor(options: PtyTerminalOptions) {
        this.options = options;
        this.messageEmitter = new EventEmitter<string>();
        this.closeEmitter = new EventEmitter<number>();
        this.onDidWrite = this.messageEmitter.event;
        this.onDidClose = this.closeEmitter.event;
        this.output = "";
    }

    // Technically this can work multiple times but please don't make a singleton out of a class meant for parallel execution
    public open(): void {
        this.output = "";
        this.exitCode = undefined;
        this.process = spawn(this.options.path, typeof this.options.cmd == "string" ? this.options.cmd.split(" ") : this.options.cmd, {
            env: {
                ...process.env,
                // Child process spawns a terminal which doesn't provide colors by default, so we force them
                FORCE_COLOR: "1",
                CLICOLOR_FORCE: "1",
                GEODE_FORCE_ENABLE_TERMINAL_COLORS: "1"
            }
        });

        this.process.stdout?.on("data", (data) => this.handleData(data.toString(), this.options.onWriteOut));
        this.process.stderr?.on("data", (data) => this.handleData(data.toString(), this.options.onWriteErr));
        this.process.on("close", this.handleClose.bind(this)).on("disconnect", this.handleClose.bind(this));
    }

    public handleInput(data: string): void {
        if (this.exitCode != undefined && this.options.userClosed) {
            this.closeEmitter.fire(0);
            this.options.onTerminalClose?.(this.exitCode, this.output);
        } else {
            this.process?.stdin?.write(data);
            this.process?.stdin?.end();
        }
    }

    public close(): void {
        this.process?.kill();
    }

    private handleData(data: string, callback?: (data: string) => void): void {
        this.output += data;

        this.messageEmitter.fire(data.replace(/(?!\r)\n/g, "\r\n"));
        callback?.(data);
    }

    private handleClose(code?: number) {
        this.exitCode = code ?? 0;
        this.options.onProcessClose?.(this.exitCode, this.output);

        if (this.options.userClosed) {
            this.messageEmitter.fire((this.output.endsWith("\n") ? "" : "\r\n") + "\x1b[47m * \x1b[0m Press any key to close the terminal...\r\n");
        } else {
            this.closeEmitter.fire(0);
            this.options.onTerminalClose?.(this.exitCode, this.output);
        }
    }
}