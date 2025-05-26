import { Option } from "../../utils/monads";
import { GetWidgetProperties, MergeProperties, UpdateType, Widget } from "../Widget";
import { Codicon } from "./types/Icon";
import { EventWidget, PartialEventWidgetProperties } from "./Interactive";

export abstract class BaseButton extends EventWidget {

    private static readonly EVENT_NAME = "button";

    public static readonly RESOURCES = EventWidget.constructResources(BaseButton.EVENT_NAME, "click", "undefined");

    constructor(properties: MergeProperties<{
        onClick?: () => any
    }, PartialEventWidgetProperties>) {
        super(Widget.mergeProperties({
            eventName: BaseButton.EVENT_NAME,
            onEvent: properties.onClick
        }, properties));
    }

    public override build(): string {
        return /*html*/ `
            <vscode-button ${this.getFormattedAttributes()}>
                ${this.getAddonHTML()}
                ${this.buildChildren()}
            </vscode-button>
        `;
    }

    protected abstract getAddonHTML(): string;
}

export class Button extends BaseButton {

    protected title: string;

    protected startIcon?: Codicon;

    protected endIcon?: Codicon;

    constructor(properties: MergeProperties<{
        title: string,
        startIcon?: Codicon,
        endIcon?: Codicon
    }, GetWidgetProperties<typeof BaseButton>>) {
        super(properties);

        this.title = properties.title;
        this.startIcon = properties.startIcon;
        this.endIcon = properties.endIcon;
    }

    public getTitle(): string {
        return this.title;
    }

    public setTitle(title: string): this {
        return this.update(UpdateType.SET_TEXT, {
            text: this.title = title
        });
    }

    public getStartIcon(): Option<Codicon> {
        return this.startIcon;
    }

    public setStartIcon(icon: Codicon): this {
        return this.update(UpdateType.ADDED_ATTRIBUTE, {
            attribute: "class",
            value: `codicon codicon-${this.startIcon = icon}`,
            forPart: "start-icon"
        });
    }

    public getEndIcon(): Option<Codicon> {
        return this.endIcon;
    }

    public setEndIcon(icon: Codicon): this {
        return this.update(UpdateType.ADDED_ATTRIBUTE, {
            attribute: "class",
            value: `codicon codicon-${this.endIcon = icon}`,
            forPart: "end-icon"
        });
    }

    protected getAddonHTML(): string {
        return /*html*/ `
            ${this.title}
            ${this.startIcon ? `<span slot="start" widget-part="start-icon" class="codicon codicon-${this.startIcon}"></span>` : ""}
            ${this.endIcon ? `<span slot="end" widget-part="end-icon" class="codicon codicon-${this.endIcon}"></span>` : ""}
        `;
    }
}

export class IconButton extends BaseButton {

    protected icon: Codicon;

    constructor(properties: MergeProperties<{
        icon: Codicon
        appearance?: "primary" | "secondary" | "icon"
    }, GetWidgetProperties<typeof BaseButton>>) {
        super(properties);

        this.icon = properties.icon;

        this.setAttribute("appearance", properties.appearance ?? "icon");
    }

    public getIcon(): Codicon {
        return this.icon;
    }

    public setIcon(icon: Codicon): this {
        return this.update(UpdateType.ADDED_ATTRIBUTE, {
            attribute: "class",
            value: `codicon codicon-${this.icon = icon}`,
            forPart: "icon"
        });
    }

    protected override getAddonHTML(): string {
        return /*html*/ `<span widget-part="icon" class="codicon codicon-${this.icon}"></span>`;
    }
}