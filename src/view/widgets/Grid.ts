import { Resources } from "../Package";
import { Widget, WidgetProperties } from "../Widget";
import { Element } from "./Basic";
import { Div } from "./Container";
import { CustomTextElement, TextProperties } from "./Text";

export class Grid extends Div {

    public static readonly RESOURCES = Resources.fromCSS(`
        .grid {
            display: grid;
            gap: .5rem;
            overflow: auto;
            align-self: stretch;
            align-items: center;
        }
    `)

	constructor(properties?: WidgetProperties) {
		super(properties);

        this.addClass("grid");
	}
}

export class DataGrid extends Element {

	constructor(properties?: WidgetProperties) {
		super(Widget.mergeProperties({
            tag: "vscode-data-grid"
        }, properties));
	}
}

export class DataGridRow extends Element {

	constructor(properties?: WidgetProperties) {
		super(Widget.mergeProperties({
            tag: "vscode-data-grid-row"
        }, properties));
	}
}

export class DataGridCell extends CustomTextElement {

	constructor(properties: TextProperties) {
		super(Widget.mergeProperties({
            tag: "vscode-data-grid-cell"
        }, properties));
	}
}