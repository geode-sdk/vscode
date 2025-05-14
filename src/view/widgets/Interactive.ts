import { Codicon } from "./types/Icon";
import { Option, Result } from "../../utils/monads";
import { Uri } from "vscode";
import { MergeProperties, UpdateType, Widget } from "../Widget";
import { Handler, ViewProvider } from "../ViewProvider";
import { Resources } from "../Package";
import { Element } from "./Basic";

export interface SelectItem {
    id: string;
    name: string;
}

export interface EventHandlerObject {
    value: string;
}

export type EventHandler = Handler<EventHandlerObject>;

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
    }>) {
        super(properties);

        this.eventName = properties.eventName;
        this.onEvent = properties.onEvent;

        this.addRegistrationID(this.eventName);
        this.registerHandler<EventHandlerObject>(`${this.eventName}-{id}`, (provider, args) => properties.onEvent?.(provider, args));
    }
}

export class Select extends EventWidget {

    private static readonly EVENT_NAME = "select";

    public static readonly RESOURCES = EventWidget.constructResources(Select.EVENT_NAME, "change", "event.target.value");
	
    protected items: SelectItem[];

	constructor(properties: MergeProperties<{
        items: (string | SelectItem)[],
        selected?: string,
        onChange?: (provider: ViewProvider, value: string) => void
    }>) {
		super(Widget.mergeProperties({
            eventName: Select.EVENT_NAME,
            onEvent: (provider, args) => {
                this.setAttribute("value", args.value);

                properties.onChange?.(provider, args.value);
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
        id ??= this.items.at(0)?.id;

		if (id && this.items.some((item) => item.id == id)) {
            return this.setAttribute("value", id);
		} else {
            return this.removeAttribute("value");
        }
	}

    public getItems(): SelectItem[] {
        return this.items;
    }

	public setItems(items: (string | SelectItem)[]): this {
		this.items = items.map((item) => typeof item == "string" ? { id: item, name: item } : item);

		return this.setSelected(this.getSelected());
	}

	public override build(): string {
		return /*html*/ `
            <vscode-dropdown ${this.getFormattedAttributes()}>
                ${this.items.map((item) => /*html*/ `<vscode-option value="${item.id}">${item.name}</vscode-option>`).join("")}
                ${this.buildChildren()}
            </vscode-dropdown>
        `;
	}
}

export class Input extends EventWidget {

    private static readonly EVENT_NAME = "input";

    public static readonly RESOURCES = EventWidget.constructResources(Input.EVENT_NAME, "input", "event.target.value");

    protected label?: string;

    protected readonly startIcon?: Codicon;

    protected readonly endIcon?: Codicon;

	constructor(properties?: MergeProperties<{
        label?: string,
        startIcon?: Codicon,
        endIcon?: Codicon,
        focus?: boolean,
        maxlength?: number,
        placeholder?: string,
        size?: number,
        value?: string,
        onChange?: EventHandler
    }>) {
		super(Widget.mergeProperties({
            eventName: Input.EVENT_NAME,
            onEvent: (provider, args) => {
                this.setAttribute("value", args.value);
                properties?.onChange?.(provider, args);
            }
        }, properties));

		this.label = properties?.label;
		this.startIcon = properties?.startIcon;
		this.endIcon = properties?.endIcon;

		this.setAttribute("autofocus", properties?.focus ?? false);
		this.setAttribute("maxlength", properties?.maxlength ?? 255);
		this.setAttribute("placeholder", properties?.placeholder);
		this.setAttribute("size", properties?.size);
		this.setAttribute("value", properties?.value);
	}

    public getLabel(): Option<string> {
        return this.label;
    }

    public setLabel(label: string): this {
        this.label = label;

        return this.rebuild(UpdateType.SET_TEXT, {
            text: label
        });
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
                ${this.label ?? ""}
                ${this.startIcon ? `<span slot="start" class="codicon codicon-${this.startIcon}"></span>` : ""}
                ${this.endIcon ? `<span slot="end" class="codicon codicon-${this.endIcon}"></span>` : ""}
                ${this.buildChildren()}
            </vscode-text-field>
        `;
	}
}

export class AudioPlayback extends Widget {

    public static readonly RESOURCES = Resources.fromCSS(`
        audio {
            transform: scale(60%);
        }
    `);

    protected readonly src: string;

    protected copiedWebviewUri?: Result<Uri>;

	constructor(properties: MergeProperties<{
        src: string
    }>) {
		super(properties);

		this.src = properties.src;
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