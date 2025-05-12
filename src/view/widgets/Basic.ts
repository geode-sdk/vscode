import { MergeProperties, UpdateType, Widget, WidgetProperties } from "../Widget";

export type ElementProperties = MergeProperties<{
    tag: string
}>;

export class Element extends Widget {

    public static tagProperties(tag: string, properties?: WidgetProperties): ElementProperties {
        return { tag, ...properties };
    }

	protected readonly tag: string;

	constructor(properties: ElementProperties) {
		super(properties);

		this.tag = properties.tag;
	}

    public getTag(): string {
        return this.tag;
    }

	public override build(): string {
		return /*html*/ `
            <${this.tag} ${this.getFormattedAttributes()}>
                ${this.buildChildren()}
            </${this.tag}>
        `;
	}
}

export class Image extends Element {

    protected data: string;

	constructor(properties: MergeProperties<{
        data: string
    }>) {
		super(Element.tagProperties("img", properties));

        this.data = properties.data;

		this.setAttribute("src", `data:image/png;base64,${properties.data}`);
	}

    public getData(): string {
        return this.data;
    }

	public setData(data: string): this {
        this.data = data;

		return this.setAttribute("src", `data:image/png;base64,${data}`);
	}
}

export class LoadingCircle extends Element {

	constructor(properties?: WidgetProperties) {
		super(Element.tagProperties("vscode-progress-ring", properties));
	}
}

export class Separator extends Element {

	constructor(properties?: WidgetProperties) {
		super(Element.tagProperties("hr", properties));
	}
}

export class Badge extends Widget {
	
    protected count: number;

	constructor(properties: MergeProperties<{
        count: number
    }>) {
		super(properties);

		this.count = properties.count;
	}

	public getCount(): number {
		return this.count;
	}

	public setCount(count: number): this {
		return this.rebuild(UpdateType.SET_TEXT, {
            text: (this.count = count).toString()
        });
	}

	public override build(): string {
		return /*html*/ `
            <vscode-badge ${this.getFormattedAttributes()}>
                ${this.count}
                ${this.buildChildren()}
            </vscode-badge>
        `;
	}
}