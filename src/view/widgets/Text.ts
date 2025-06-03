import { Resources } from "../Package";
import { MergeProperties, UpdateType, Widget } from "../Widget";
import { Element, ElementProperties } from "./Basic";
import { Codicon } from "./types/Icon";

export type CustomTextElementProperties = MergeProperties<{
    text: string
}, ElementProperties>;

export type TextProperties = MergeProperties<{
    text: string
}>;

export type HeadRange = 1 | 2 | 3 | 4 | 5 | 6;

export class CustomTextElement extends Element {

    protected text: string;

    constructor(properties: CustomTextElementProperties) {
        super(properties);

        this.text = properties.text;
    }

    public getText(): string {
        return this.text;
    }

    public setText(text: string): this {
        this.text = text;

        return this.update(UpdateType.SET_TEXT, { text });
    }

    public override build(): string {
        return /*html*/ `
            <${this.tag} ${this.getFormattedAttributes()}>
                ${this.text}
                ${this.buildChildren()}
            </${this.tag}>
        `;
    }
}

export class Text extends CustomTextElement {

    constructor(properties: TextProperties) {
        super(Widget.mergeProperties({
            tag: "p"
        }, properties));
    }
}

export class Head extends CustomTextElement {

    protected readonly size: HeadRange;

    constructor(properties: MergeProperties<{
        size?: HeadRange
    }, TextProperties>) {
        super(Widget.mergeProperties({
            tag: `h${properties.size ??= 1}`
        }, properties));

        this.size = properties.size;
    }

    public getSize(): HeadRange {
        return this.size;
    }
}

export class Label extends CustomTextElement {

    public static readonly RESOURCES = Resources.fromCSS(`
        .label {
            display: block;
            color: var(--vscode-descriptionForeground);
        }
    `);

    constructor(properties: MergeProperties<{
        for: string
    }, TextProperties>) {
        super(Widget.mergeProperties({
            tag: "label"
        }, properties));

        this.addClass("label");
        this.setAttribute("for", properties.for);
    }
}

export class IconText extends Widget {

    public static readonly RESOURCES = Resources.fromCSS(`
        .icon-text > * {
            display: inline-block;
        }

        .icon-text .codicon {
            vertical-align: text-top;
        }
    `);

    private readonly prefixWidget: Text;

    private readonly suffixWidget: Text;

    public readonly iconWidget: Element;

    private icon: Codicon;

    constructor(properties: MergeProperties<{
        prefixText?: string,
        suffixText?: string,
        icon: Codicon
    }>) {
        super(properties);

        this.prefixWidget = new Text({ text: properties.prefixText ?? "" });
        this.suffixWidget = new Text({ text: properties.suffixText ?? "" });
        this.iconWidget = new Element({
            tag: "span",
            className: "codicon"
        });

        this.addClass("icon-text")
            .addChild(this.prefixWidget, this.iconWidget, this.suffixWidget)
            .setIcon(this.icon = properties.icon);
    }

    public getPrefixText(): string {
        return this.prefixWidget.getText();
    }

    public setPrefixText(text: string): this {
        this.prefixWidget.setText(text);

        return this;
    }

    public getPrefixWidget(): Text {
        return this.prefixWidget;
    }

    public getSuffixText(): string {
        return this.suffixWidget.getText();
    }

    public setSuffixText(text: string): this {
        this.suffixWidget.setText(text);

        return this;
    }

    public getSuffixWidget(): Text {
        return this.suffixWidget;
    }

    public getIcon(): Codicon {
        return this.icon;
    }

    public setIcon(icon: Codicon): this {
        this.iconWidget.removeClass(`codicon-${this.icon}`).addClass(`codicon-${this.icon = icon}`);

        return this;
    }

    public getIconWidget(): Element {
        return this.iconWidget;
    }

    public override build(): string {
        return /*html*/ `
            <span ${this.getFormattedAttributes()}>
                ${this.buildChildren()}
            </span>
        `;
    }
}