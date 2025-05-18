import { Option } from "../../utils/monads";
import { ViewProvider } from "../ViewProvider";
import { GetWidgetProperties, MergeProperties, UpdateType, Widget } from "../Widget";
import { Codicon } from "./types/Icon";
import { EventWidget } from "./Interactive";

export abstract class BaseButton extends EventWidget {

    private static readonly EVENT_NAME = "button";

    public static readonly RESOURCES = EventWidget.constructResources(BaseButton.EVENT_NAME, "click", "undefined");

    constructor(properties: MergeProperties<{
        onClick?: (provider: ViewProvider) => any
    }>) {
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

    protected readonly startIcon?: Codicon;

    protected readonly endIcon?: Codicon;

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
        return this.rebuild(UpdateType.SET_TEXT, {
            text: this.title = title
        });
    }

    public getStartIcon(): Option<Codicon> {
        return this.startIcon;
    }

    public getEndIcon(): Option<Codicon> {
        return this.endIcon;
    }

    protected getAddonHTML(): string {
        return /*html*/ `
            ${this.title}
            ${this.startIcon ? `<span slot="start" class="codicon codicon-${this.startIcon}"></span>` : ""}
            ${this.endIcon ? `<span slot="end" class="codicon codicon-${this.endIcon}"></span>` : ""}
        `;
    }
}

export class IconButton extends BaseButton {

    protected readonly icon: Codicon;

    constructor(properties: MergeProperties<{
        icon: Codicon
    }, GetWidgetProperties<typeof BaseButton>>) {
        super(properties);

        this.icon = properties.icon;

        this.setAttribute("appearance", "icon");
    }

    public getIcon(): Codicon {
        return this.icon;
    }

    protected override getAddonHTML(): string {
        return /*html*/ `<span class="codicon codicon-${this.icon}"></span>`;
    }
}