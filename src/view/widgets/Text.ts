import { Resources } from "../Package";
import { MergeProperties, UpdateType, Widget } from "../Widget";
import { Element, ElementProperties } from "./Basic";

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