import { Option } from "../../utils/monads";
import { MergeProperties, UpdateType, Widget } from "../Widget";
import { Codicon } from "./types/Icon";
import { EventWidget, PartialEventWidgetProperties } from "./Interactive";
import { Element } from "./Basic";
import { Resources } from "../Package";

export type SlotType = Widget | Codicon;

export type Appearence = "primary" | "secondary" | "icon";

export type BaseButtonProperties<T extends BaseButton> = MergeProperties<{
    appearance?: Appearence,
    onClick?: (button: T) => any
}, PartialEventWidgetProperties>;

export abstract class BaseButton extends EventWidget {

    private static readonly EVENT_NAME = "button";

    public static readonly EVENT_RESOURCES = EventWidget.constructResources(BaseButton.EVENT_NAME, "click", "undefined");

    public static readonly RESOURCES = Resources.fromCSS(`
        vscode-button > * {
            width: auto;
            max-height: 1rem;
        }
    `);

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

    public click(): this {
        this.onEvent?.({
            value: ""
        }, this);

        return this;
    }

    public override build(): string {
        return /*html*/ `
            <vscode-button ${this.getFormattedAttributes()}>
                ${this.title ?? ""}
                ${this.buildChildren()}
            </vscode-button>
        `;
    }

    protected setSlot(slot: "start" | "end" | undefined, original: Option<Widget>, content: SlotType): Widget {
        const widget = typeof content == "string" ? new Element({
            tag: "span",
            className: `codicon codicon-${content}`,
            attributes: slot ? { slot } : {}
        }) : content.setAttribute("slot", slot);

        this.replaceChild(original, widget);

        return widget;
    }
}

export class Button extends BaseButton {

    public static readonly RESOURCES = Resources.fromCSS(`
        .end-slot-button::part(end) {
            margin-inline-start: 8px;
            display: flex;
        }
    `);

    protected start?: SlotType;

    protected startWidget?: Widget;

    protected end?: SlotType;

    protected endWidget?: Widget;

    constructor(properties: MergeProperties<{
        title: string,
        start?: SlotType,
        end?: SlotType,
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

    public getStart(): Option<SlotType> {
        return this.start;
    }

    public setStart(start: SlotType): this {
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

    public getEnd(): Option<SlotType> {
        return this.end;
    }

    public setEnd(end: SlotType): this {
        this.endWidget = this.setSlot("end", this.endWidget, this.end = end);

        this.addClass("end-slot-button");

        return this;
    }

    public removeEnd(): this {
        if (this.endWidget) {
            this.removeClass("end-slot-button");
            this.removeChild(this.endWidget);
            this.endWidget = undefined;
            this.end = undefined;
        }

        return this;
    }

    public getEndWidget(): Option<Widget> {
        return this.endWidget;
    }
}

export class IconButton extends BaseButton {

    protected contentWidget?: Widget;

    protected content: SlotType;

    constructor(properties: MergeProperties<{
        content: SlotType,
        appearance?: Appearence
    }, BaseButtonProperties<IconButton>>) {
        super({
            ...properties,
            appearance: properties.appearance ?? "icon"
        });

        this.setContent(this.content = properties.content);
    }

    public getContent(): SlotType {
        return this.content;
    }

    public setContent(content: SlotType): this {
        this.contentWidget = this.setSlot(undefined, this.contentWidget, this.content = content);

        return this;
    }

    public getContentWidget(): Option<Widget> {
        return this.contentWidget;
    }
}