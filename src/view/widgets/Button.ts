import { Option } from "../../utils/monads";
import { MergeProperties, UpdateType, Widget } from "../Widget";
import { Codicon } from "./types/Icon";
import { EventWidget, PartialEventWidgetProperties } from "./Interactive";
import { Element } from "./Basic";

export type Appearence = "primary" | "secondary" | "icon";

export type BaseButtonProperties<T extends BaseButton> = MergeProperties<{
    appearance?: Appearence,
    onClick?: (button: T) => any
}, PartialEventWidgetProperties>;

export abstract class BaseButton extends EventWidget {
                                   
    private static readonly EVENT_NAME = "button";

    public static readonly RESOURCES = EventWidget.constructResources(BaseButton.EVENT_NAME, "click", "undefined");

    protected title?: string;

    constructor(properties: MergeProperties<{
        title?: string,
        appearance: Appearence
    }, BaseButtonProperties<any>>) {
        super(Widget.mergeProperties({
            eventName: BaseButton.EVENT_NAME,
            onEvent: () => properties.onClick?.(this)
        }, properties));

        this.title = properties.title;

        this.setAppearance(properties.appearance);
    }

    public getTitle(): Option<string> {
        return this.title;
    }

    public setTitle(title: string): this {
        return this.update(UpdateType.SET_TEXT, {
            text: this.title = title
        });
    }

    public getAppearance(): Option<Appearence> {
        return this.getAttribute("appearance") as Appearence;
    }

    public setAppearance(appearance: Appearence): this {
        return this.setAttribute("appearance", appearance);
    }

    public override build(): string {
        return /*html*/ `
            <vscode-button ${this.getFormattedAttributes()}>
                ${this.title ?? ""}
                ${this.buildChildren()}
            </vscode-button>
        `;
    }
}

export class Button extends BaseButton {

    protected start?: Codicon | Widget;

    protected startWidget?: Widget;

    protected end?: Codicon | Widget;

    protected endWidget?: Widget;

    constructor(properties: MergeProperties<{
        title: string,
        start?: Codicon | Widget,
        end?: Codicon | Widget,
        appearance?: Appearence
    }, BaseButtonProperties<Button>>) {
        super({
            ...properties,
            appearance: properties.appearance ?? "primary"
        });

        if (properties.start) {
            this.setStart(properties.start);
        }

        if (properties.end) {
            this.setEnd(properties.end);
        }
    }

    public getStart(): Option<Codicon | Widget> {
        return this.start;
    }

    public setStart(start: Codicon | Widget): this {
        this.startWidget = this.setSlot("start", this.startWidget, this.start = start);

        return this;
    }

    public removeStart(): this {
        if (this.startWidget) {
            this.removeChild(this.startWidget);
            this.startWidget = undefined;
            this.start = undefined;
        }

        return this;
    }

    public getStartWidget(): Option<Widget> {
        return this.startWidget;
    }

    public getEnd(): Option<Codicon | Widget> {
        return this.end;
    }

    public setEnd(end: Codicon | Widget): this {
        this.endWidget = this.setSlot("end", this.endWidget, this.end = end);

        return this;
    }

    public removeEnd(): this {
        if (this.endWidget) {
            this.removeChild(this.endWidget);
            this.endWidget = undefined;
            this.end = undefined;
        }

        return this;
    }

    public getEndWidget(): Option<Widget> {
        return this.endWidget;
    }

    protected setSlot(slot: "start" | "end", original: Option<Widget>, content: Codicon | Widget): Widget {
        const widget = typeof content == "string" ? new Element({
            tag: "span",
            className: `codicon codicon-${content}`,
            attributes: {
                slot
            }
        }) : content.setAttribute("slot", slot);

        this.replaceChild(original, widget);

        return widget;
    }
}

export class IconButton extends BaseButton {

    protected readonly iconElement: Element;

    protected icon: Codicon;

    constructor(properties: MergeProperties<{
        icon: Codicon
        appearance?: Appearence
    }, BaseButtonProperties<IconButton>>) {
        super({
            ...properties,
            appearance: properties.appearance ?? "icon"
        });

        this.addChild(this.iconElement = new Element({
            tag: "span"
        }));
        this.setIcon(this.icon = properties.icon);
    }

    public getIcon(): Codicon {
        return this.icon;
    }

    public setIcon(icon: Codicon): this {
        this.iconElement.clearClasses();
        this.iconElement.addClass("codicon");
        this.iconElement.addClass(`codicon-${this.icon = icon}`);

        return this;
    }

    public getIconElement(): Element {
        return this.iconElement;
    }
}