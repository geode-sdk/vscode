import { Codicon } from "./types/Icon";
import { Option, Result } from "../../utils/monads";
import { Uri } from "vscode";
import { MergeProperties, Widget } from "../Widget";
import { Handler } from "../ViewProvider";
import { Resources } from "../Package";
import { Element } from "./Basic";
import { CustomTextElement } from "./Text";

export interface SelectItem {
    id: string;
    name: string;
}

export interface EventHandlerObject {
    value: string;
}

export type EventHandler = Handler<EventHandlerObject>;

export type PartialEventWidgetProperties = MergeProperties<{
    disabled?: boolean
}>;

export abstract class EventWidget extends Widget {

    public static readonly TEMPLATE = `
        onRegister(%s, (widget) => widget.addEventListener(%s, (event) => post(\`%l-\${getWidgetID(widget)}\`, {
            value: %l
        })));
    `;

    public static constructResources(eventName: string, frontendName: string, valueGetter: string): Resources {
        return Resources.fromJSTemplate(EventWidget.TEMPLATE, eventName, frontendName, eventName, valueGetter);
    }

    protected readonly eventName: string;

    protected readonly onEvent?: EventHandler;

    constructor(properties: MergeProperties<{
        eventName: string,
        onEvent?: EventHandler
    }, PartialEventWidgetProperties>) {
        super(properties);

        this.eventName = properties.eventName;
        this.onEvent = properties.onEvent;

        this.addRegistrationID(this.eventName);
        this.registerHandler<EventHandlerObject>(`${this.eventName}-{id}`, (args) => properties.onEvent?.(args));
        this.setDisabled(properties.disabled ?? false);
    }

    public isDisabled(): boolean {
        return this.hasAttribute("disabled");
    }

    public setDisabled(disabled: boolean): this {
        if (disabled) {
            return this.setAttribute("disabled", disabled);
        } else {
            return this.removeAttribute("disabled");
        }
    }
}

export class Select extends EventWidget {

    private static readonly EVENT_NAME = "select";

    public static readonly RESOURCES = EventWidget.constructResources(Select.EVENT_NAME, "change", "event.target.value");
    
    protected items: SelectItem[];

    constructor(properties: MergeProperties<{
        items: (string | SelectItem)[],
        selected?: string,
        onChange?: (value: string) => any
    }, PartialEventWidgetProperties>) {
        super(Widget.mergeProperties({
            eventName: Select.EVENT_NAME,
            onEvent: (args) => {
                this.setAttribute("value", args.value);

                properties.onChange?.(args.value);
            }
        }, properties));

        this.items = [];

        this.setAttribute("value", properties.selected);
        this.setItems(properties.items);
    }

    public getSelected(): Option<string> {
        return this.getAttribute("value");
    }

    public setSelected(id?: string): this {
        const reserveID = this.items.at(0)?.id;
        id ??= reserveID;

        if (id && this.items.some((item) => item.id == id)) {
            return this.setAttribute("value", id);
        } else if (reserveID) {
            return this.setAttribute("value", reserveID);
        } else {
            return this.removeAttribute("value");
        }
    }

    public getItems(): SelectItem[] {
        return this.items;
    }

    public setItems(items: (string | SelectItem)[]): this {
        this.items = items.map((item) => typeof item == "string" ? { id: item, name: item } : item);

        this.clear();
        this.items.forEach((item) => this.addChild(new CustomTextElement({
            tag: "vscode-option",
            text: item.name,
            attributes: {
                value: item.id
            }
        })));

        return this.setSelected(this.getSelected());
    }

    public override build(): string {
        return /*html*/ `
            <vscode-dropdown ${this.getFormattedAttributes()}>
                ${this.buildChildren()}
            </vscode-dropdown>
        `;
    }
}

export class Input extends EventWidget {

    private static readonly EVENT_NAME = "input";

    public static readonly RESOURCES = EventWidget.constructResources(Input.EVENT_NAME, "input", "event.target.value");

    protected readonly startIcon?: Codicon;

    protected readonly endIcon?: Codicon;

    constructor(properties?: MergeProperties<{
        startIcon?: Codicon,
        endIcon?: Codicon,
        focus?: boolean,
        maxlength?: number,
        placeholder?: string,
        size?: number,
        value?: string,
        onChange?: EventHandler
    }, PartialEventWidgetProperties>) {
        super(Widget.mergeProperties({
            eventName: Input.EVENT_NAME,
            onEvent: (args) => {
                this.setAttribute("value", args.value);
                properties?.onChange?.(args);
            }
        }, properties));

        this.startIcon = properties?.startIcon;
        this.endIcon = properties?.endIcon;

        this.setAttribute("autofocus", properties?.focus ?? false);
        this.setAttribute("maxlength", properties?.maxlength ?? 255);
        this.setAttribute("placeholder", properties?.placeholder);
        this.setAttribute("size", properties?.size);
        this.setAttribute("value", properties?.value);
    }

    public getStartIcon(): Option<Codicon> {
        return this.startIcon;
    }

    public getEndIcon(): Option<Codicon> {
        return this.endIcon;
    }

    public isAutofocus(): boolean {
        return this.getAttribute("autofocus") == "true";
    }

    public setAutofocus(autofocus: boolean): this {
        return this.setAttribute("autofocus", autofocus);
    }

    public getMaxLength(): Option<number> {
        const maxlength = this.getAttribute("maxlength");

        return maxlength ? parseInt(maxlength) : undefined;
    }

    public setMaxLength(maxlength: number): this {
        return this.setAttribute("maxlength", maxlength);
    }

    public getPlaceholder(): Option<string> {
        return this.getAttribute("placeholder");
    }

    public setPlaceholder(placeholder: string): this {
        return this.setAttribute("placeholder", placeholder);
    }

    public getSize(): Option<number> {
        const size = this.getAttribute("size");

        return size ? parseInt(size) : undefined;
    }

    public setSize(size: number): this {
        return this.setAttribute("size", size);
    }

    public getValue(): Option<string> {
        return this.getAttribute("value");
    }

    public setValue(value: string): this {
        return this.setAttribute("value", value);
    }

    public override build(): string {
        return /*html*/ `
            <vscode-text-field ${this.getFormattedAttributes()}>
                ${this.startIcon ? `<span slot="start" class="codicon codicon-${this.startIcon}"></span>` : ""}
                ${this.endIcon ? `<span slot="end" class="codicon codicon-${this.endIcon}"></span>` : ""}
                ${this.buildChildren()}
            </vscode-text-field>
        `;
    }
}

export class AudioPlayback extends Widget {

    public static readonly RESOURCES = Resources.fromResources({
        js: `
            onRegister("audio-playback", (widget) => {
                widget.getElementsByTagName("audio")[0]?.addEventListener("play", (event) => {
                    Array.from(document.getElementsByTagName("audio"))
                        .filter((audio) => audio != event.target)
                        .forEach((audio) => audio.pause());
                });
            });
        `,
        css: `
            .audio-playback {
                width: 100%;
            }

            audio {
                margin: calc(-100% / 12) calc(-100% / 3);
                /* Force the correct scale without screwing up the control sizes */
                min-width: calc(100% / 0.6);
                max-width: calc(100% / 0.6);
                transform: scale(60%);
            }

            audio::-webkit-media-controls-enclosure {
                background-color: var(--button-secondary-background);
                border-radius: calc(var(--corner-radius-round) * 1px);
            }

            .vscode-dark audio {
                color-scheme: dark;
            }
        `
    });

    protected readonly src: string;

    protected copiedWebviewUri?: Result<Uri>;

    constructor(properties: MergeProperties<{
        src: string
    }>) {
        super(properties);

        this.src = properties.src;
        this.addClass("audio-playback");
        this.addRegistrationID("audio-playback");
    }

    public getSrc(): string {
        return this.src;
    }

    public override build(): string {
        return /*html*/ `
            <div ${this.getFormattedAttributes()}>
                ${this.copiedWebviewUri?.isValue() ? /*html*/ `
                    <audio controls>
                        <source src="${this.copiedWebviewUri.unwrap()}">
                    </audio>
                ` : (this.copiedWebviewUri ? /*html*/ `
                    <p>Unable to load audio: ${this.copiedWebviewUri?.unwrapErr()}</p>
                ` : "")}
                ${this.buildChildren()}
            </div>
        `;
    }

    protected override postInit(): void {
        this.copiedWebviewUri = this.generateTempCopy(this.src);
    }
}

// I know that the redirecting in this sucks,
// I tried to fix it but someone at VSCode decided to dial the content security policy to 11 so I can't access anything which allows me to catch redirects.
export class IFrame extends Element {

    constructor(properties: MergeProperties<{
        src: string
    }>) {
        super(Widget.mergeProperties({
            tag: "iframe"
        }, properties));

        this.setAttribute("src", properties.src);
    }

    public getSrc(): Option<string> {
        return this.getAttribute("src");
    }

    public setSrc(src: string): this {
        return this.setAttribute("src", src);
    }
}