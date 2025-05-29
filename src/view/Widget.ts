import { Disposable, Uri, Webview, WebviewView } from "vscode";
import { ViewProvider, Handler } from "./ViewProvider";
import { Err, Ok, Option, Result } from "../utils/monads";
import { basename } from "path";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { Package } from "./Package";
import { BlacklistChars } from "./widgets/types/StringTypes";
import { getExtContext } from "../config";

export interface WidgetProperties {
    id?: string;
    className?: string;
    children?: Widget[];
    attributes?: Record<string, string>;
    style?: Record<string, string>;
    hoverText?: string;
    ariaLabel?: string;
}

export type GetWidgetProperties<T extends abstract new(properties: any) => Widget> = NonNullable<ConstructorParameters<T>[0]>;

export type MergeProperties<T1, T2 extends WidgetProperties | undefined = WidgetProperties> = T1 & T2;

export type PropertyString<T extends string> = BlacklistChars<T, " \t\n">;

export type StylePropertyString<T extends string> = BlacklistChars<T, " \t\n:;">;

export enum UpdateType {
    ADDED_ATTRIBUTE = "added-attribute",
    REMOVED_ATTRIBUTE = "removed-attribute",
    ADDED_CHILD = "added-child",
    REMOVED_CHILD = "removed-child",
    SET_TEXT = "set-text"
}

export interface UpdateInfoForType {
    [UpdateType.ADDED_ATTRIBUTE]: {
        attribute: string,
        value: string
    };
    [UpdateType.REMOVED_ATTRIBUTE]: {
        attribute: string
    };
    [UpdateType.ADDED_CHILD]: {
        html: string
    };
    [UpdateType.REMOVED_CHILD]: {
        id: string
    } | {
        forPart: string
    };
    [UpdateType.SET_TEXT]: {
        text: string
    };
}

export abstract class Widget {

    private static ID_ITERATOR = 0;

    private static OBSERVER_ITERATOR = 0;

    public static mergeProperties<T1, T2 extends WidgetProperties | undefined>(object: T1, properties: T2): MergeProperties<T1, T2> {
        return { ...object, ...properties };

    }

    private readonly widgetID: string;

    private readonly package: Package;

    private readonly attributes: Map<string, string>;

    private readonly styleOverrides: Map<string, string>;

    private readonly children: Widget[];

    private readonly registrationID: string[];

    private readonly ownedFiles: string[];

    private readonly disposables: Disposable[];

    private readonly observers: number[];

    private postQueue: { cmd: string, args: any }[];

    private handlerBackup: Map<string, Handler<any>>;

    private provider?: ViewProvider;

    private parent?: Widget;

    public constructor(properties?: WidgetProperties) {
        this.widgetID = `${this.constructor.name}-${Widget.ID_ITERATOR++}`;
        this.package = new Package(this);
        this.attributes = new Map(Object.entries(properties?.attributes ?? {}));
        this.styleOverrides = new Map(Object.entries(properties?.style ?? {}));
        this.children = [];
        this.registrationID = [];
        this.ownedFiles = [];
        this.disposables = [];
        this.observers = [];
        this.postQueue = [];
        this.handlerBackup = new Map();

        this.setAttribute("widget-id", this.widgetID);

        if (properties?.children) {
            this.addChild(...properties.children);
        }

        if (properties?.id) {
            this.setAttribute("id", properties.id);
        }

        if (properties?.className) {
            this.setAttribute("class", properties.className);
        }

        if (properties?.hoverText) {
			this.setAttribute("title", properties.hoverText).setAttribute("aria-label", properties.hoverText);
		}

        if (properties?.ariaLabel) {
            this.setAttribute("aria-label", properties.ariaLabel);
        }
    }

    public abstract build(): string;

    public onShow?(): void;

    public onHide?(): void;

    public getAttribute<T extends string>(name: PropertyString<T>): Option<string> {
        return this.attributes.get(name);
    }

    public hasAttribute<T extends string>(name: PropertyString<T>): boolean {
        return this.attributes.has(name);
    }

    public setAttribute<T1 extends string, T2 extends { toString: () => string }>(name: PropertyString<T1>, value?: T2): this {
        if (typeof value != "undefined") {
            const stringValue = value.toString();
            this.attributes.set(name, stringValue);

            this.update(UpdateType.ADDED_ATTRIBUTE, {
                attribute: name,
                value: stringValue
            });
        }

        return this;
    }

    public removeAttribute<T extends string>(name: PropertyString<T>): this {
        if (this.attributes.has(name)) {
            this.attributes.delete(name);

            this.update(UpdateType.REMOVED_ATTRIBUTE, {
                attribute: name
            });
        }

        return this;
    }

    public getWidgetID(): string {
        return this.widgetID;
    }

    public getID(): Option<string> {
        return this.getAttribute("id");
    }

    public setID<T extends string>(id?: PropertyString<T>): this {
        if (id) {
            return this.setAttribute("id", id);
        } else {
            return this.removeAttribute("id");
        }
    }

    public getClasses(): Option<string[]> {
        return this.getAttribute("class")
            ?.split(" ")
            .filter((part) => part.length);
    }

    public addClass<T extends string>(className: PropertyString<T>): this {
        const attribute = this.getAttribute("class");

        if (attribute) {
            return this.setAttribute("class", `${attribute} ${className}`);
        } else {
            return this.setAttribute("class", className);
        }
    }

    public clearClasses(): this {
        return this.removeAttribute("class");
    }

    public getHoverText(): Option<string> {
        return this.getAttribute("title");
    }

    public setHoverText(text?: string): this {
        if (text) {
            return this.setAttribute("title", text).setAttribute("aria-label", text);
        } else {
            return this.removeAttribute("title").removeAttribute("aria-label");
        }
    }

    public getStyleOverride<T extends string>(key: StylePropertyString<T>): Option<string> {
        return this.styleOverrides.get(key);
    }

    public setStyleOverride<T1 extends string, T2 extends string>(key: StylePropertyString<T1>, value: BlacklistChars<T2, ":;">): this {
        this.styleOverrides.set(key, value);

        return this.update(UpdateType.ADDED_ATTRIBUTE, {
            attribute: "style",
            value: this.getFormattedStyle()
        });
    }

    public removeStyleOverride<T extends string>(key: StylePropertyString<T>): this {
        if (this.styleOverrides.has(key)) {
            this.styleOverrides.delete(key);

            this.update(UpdateType.ADDED_ATTRIBUTE, {
                attribute: "style",
                value: this.getFormattedStyle()
            });
        }

        return this;
    }

    public getChildren(): Widget[] {
        return this.children;
    }

    public getChildByWidgetID<T1 extends Widget, T2 extends string>(id: PropertyString<T2>, recursive = false): Option<T1> {
        for (const child of this.children) {
            if (child.getWidgetID() == id) {
                return child as T1;
            } else if (recursive) {
                const found = child.getChildByWidgetID(id, true);

                if (found) {
                    return found as T1;
                }
            }
        }

        return undefined;
    }

    public getChildByID<T1 extends Widget, T2 extends string>(id: PropertyString<T2>, recursive = false): Option<T1> {
        for (const child of this.children) {
            if (child.getID() == id) {
                return child as T1;
            } else if (recursive) {
                const found = child.getChildByID(id, true);

                if (found) {
                    return found as T1;
                }
            }
        }

        return undefined;
    }

    public addChild(...children: Widget[]): this {
        children.forEach((child) => {
            if (child.parent) {
                child.parent.removeChild(child);
            }

            this.children.push(child);
            this.package.merge(child.getPackage());
            child.parent = this;

            if (this.parent) {
                this.parent.getPackage().merge(child.getPackage());
            }

            if (this.provider) {
                this.provider.addPackage(child.getPackage());

                this.update(UpdateType.ADDED_CHILD, {
                    html: child.init(this.provider)
                });
            }
        });

        return this;
    }

    public removeChild(child?: Widget): this {
        if (!child) {
            return this;
        }

        const index = this.children.indexOf(child);

        if (index != -1) {
            child.parent = undefined;

            this.children.splice(index, 1);
            child.dispose();
        }

        return this.update(UpdateType.REMOVED_CHILD, {
            id: child.getWidgetID()
        });
    }

    public replaceChild(oldChild?: Widget, newChild?: Widget): this {
        this.removeChild(oldChild);

        if (newChild) {
            return this.addChild(newChild);
        } else {
            return this;
        }
    }

    public getParent(): Option<Widget> {
        return this.parent;
    }

    public dispatchEvent(id: string, args?: any): this {
        this.provider?.dispatchEvent(id, args);

        return this;
    }

    public registerObserver(callback: (widget: Widget, visible: boolean) => any): number {
        const id = Widget.OBSERVER_ITERATOR++;

        this.observers.push(id);
        this.post("create-observer", {
            id,
            root: this.widgetID
        });
        this.registerHandler<{ entries: {
            id: string,
            visible: boolean
        }[] }>(`visibility-changed-${id}`, (args) => args.entries.forEach((entry) => {
            const child = this.getChildByWidgetID(entry.id, true);

            if (child) {
                callback(child, entry.visible);
            }
        }));

        return id;
    }

    public clear(): this {
		Array.from(this.children).forEach(this.removeChild, this);

        return this;
	}

    public removeObserver(id: number): this {
        const index = this.observers.indexOf(id);

        if (index != -1) {
            this.post("remove-observer", { id });
            this.unregisterHandler(`visibility-changed-${id}`);
            this.observers.splice(index, 1);
        }

        return this;
    }

    public dispose(): this {
        this.onHide?.();
        this.cleanupOwnedFiles().cleanupDisposables().cleanupObservers();
        this.handlerBackup.forEach((_, id) => this.provider?.unregisterHandler(id));
        this.children.forEach((widget) => widget.dispose());

        this.postQueue = [];
        this.provider = undefined;

        return this;
    }

    protected preInit?(): void;

    protected postInit?(): void;

    protected init(provider: ViewProvider): string {
        this.preInit?.();
        this.onShow?.();
        this.children.forEach((child) => child.init(provider));

        this.provider = provider;
        this.postQueue.forEach(({ cmd, args }) => this.post(cmd, args));
        this.handlerBackup.forEach((handler, id) => this.provider!.registerHandler(id, handler));

        this.postQueue = [];

        this.postInit?.();

        return this.build();
    }

    protected getPackage(): Package {
        return this.package;
    }

    protected getProvider(): Option<ViewProvider> {
        return this.provider;
    }

    protected getView(): Option<WebviewView> {
        return this.provider?.getView();
    }

    protected getWebview(): Option<Webview> {
        return this.provider?.getWebview();
    }

    protected getFormattedAttributes(): string {
        return Array.from(this.attributes.entries()).concat(Object.entries({
            "register-handlers": this.registrationID.join(","),
            "style": this.getFormattedStyle()
        })).map(([key, value]) => `${key}="${value.replaceAll("\"", "\\\"")}"`).join(" ");
    }

    protected buildChildren(): string {
        return this.children.map((child) => child.build()).join("");
    }

    protected post(cmd: string, args: any): this {
        if (this.provider) {
            this.provider.post(cmd, args);
        } else {
            this.postQueue.push({ cmd, args });
        }

        return this;
    }

    protected addRegistrationID<T extends string>(id: BlacklistChars<T, ",">): this {
        if (!this.registrationID.includes(id)) {
            this.registrationID.push(id);
        }

        return this;
	}

    protected registerHandler<T>(id: string, handler: Handler<T>): string {
        const handlerID = id.replaceAll("{id}", this.widgetID);

        this.handlerBackup.set(handlerID, handler);
        this.provider?.registerHandler(handlerID, handler);

        return handlerID;
    }

    protected unregisterHandler(id: string): this {
        this.handlerBackup.delete(id);
        this.provider?.unregisterHandler(id);

        return this;
    }

    protected getTempMediaPath(): Uri {
		return Uri.joinPath(getExtContext().extensionUri, "temp-media");
	}

    protected generateTempCopy(path: string): Result<Uri> {
        const webview = this.getWebview();

        if (!webview) {
            return Err("Provider is not set");
        }

		try {
			// VSCode webviews can't play arbitary parths so we copy media files
			// to a whitelisted temporary directory and play from there
			const newDir = this.getTempMediaPath();
			const newPath = Uri.joinPath(newDir, basename(path));

			if (!existsSync(newDir.fsPath)) {
				mkdirSync(newDir.fsPath);
			}

			copyFileSync(path, newPath.fsPath);
            this.registerOwnedFile(newPath.fsPath);

			return Ok(webview.asWebviewUri(newPath));
		} catch (error: any) {
			return Err(error.toString());
		}
	}

    protected getOwnedFiles(): string[] {
        return this.ownedFiles;
    }

    protected registerOwnedFile(file: string): this {
        this.ownedFiles.push(file);

        return this;
    }

    protected unregisterOwnedFile(file: string): this {
        const index = this.ownedFiles.indexOf(file);

        if (index != -1) {
            try {
                rmSync(file);
            } catch (error) {
                console.error(`Error deleting file: ${file}`, error);
            }

            this.ownedFiles.splice(index, 1);
        }

        return this;
    }

    protected getDisposables(): Disposable[] {
        return this.disposables;
    }

    protected registerDisposable(disposable: Disposable): this {
        this.disposables.push(disposable);

        return this;
    }

    protected unregisterDisposable(disposable: Disposable): this {
        const index = this.disposables.indexOf(disposable);

        if (index != -1) {
            this.disposables.splice(index, 1);
            disposable.dispose();
        }

        return this;
    }

    protected update<T extends UpdateType>(reason: T, args: UpdateInfoForType[T] & { forPart?: string }): this {
        if (this.provider) {
            this.post("update-widget", {
                id: this.widgetID,
                reason,
                args
            });
        }

        return this;
    }

    protected propegateAction(action: (widget: Widget) => any): this {
        action(this);

        this.children.forEach((child) => {
            action(child);

            child.propegateAction(action);
        });

        return this;
    }

    private getFormattedStyle(): string {
        return Array.from(this.styleOverrides.entries())
            .map(([key, value]) => `${key}: ${value}`)
            .join("; ");
    }

    private cleanupOwnedFiles(): this {
        Array.from(this.ownedFiles).forEach(this.unregisterOwnedFile, this);

        return this;
    }

    private cleanupDisposables(): this {
        Array.from(this.disposables).forEach(this.unregisterDisposable, this);

        return this;
    }

    private cleanupObservers(): this {
        Array.from(this.observers).forEach(this.removeObserver, this);

        return this;
    }
}