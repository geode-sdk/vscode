import { Widget, ScriptPackage, AttrMode, WidgetProps } from "./Widget";

export enum Alignment {
	start,
	center,
	end,
}

function alignToString(align: Alignment): string {
	return Alignment[align];
}

export interface DivProps {
	vAlign?: Alignment;
	hAlign?: Alignment;
}

export class Div extends Widget {
	static scripts: ScriptPackage = {
		id: "Div",
	};

	build(): string {
		return /*html*/ `
            <div ${this.buildAttrs()}>
                ${super.build()}
            </div>
        `;
	}
}

export class PaddedDiv extends Widget {
	static scripts: ScriptPackage = {
		id: "PaddedDiv",
		css: /*css*/ `
            .padded-div {
                padding: 1rem;
            }
        `,
	};

	constructor(props?: WidgetProps) {
		super(props);
		this.attr("class", "padded-div", AttrMode.add);
	}

	build(): string {
		return /*html*/ `
            <div ${this.buildAttrs()}>
                ${super.build()}
            </div>
        `;
	}
}

export class Column extends Widget {
	static scripts: ScriptPackage = {
		id: "Column",
		css: /*css*/ `
            .column {
                display: flex;
                flex-direction: column;
            }
            .column.valign-start {
                justify-content: flex-start;
            }
            .column.valign-center {
                justify-content: center;
            }
            .column.valign-end {
                justify-content: flex-end;
            }
            .column.halign-start {
                align-items: flex-start;
            }
            .column.halign-center {
                align-items: center;
            }
            .column.halign-end {
                align-items: flex-end;
            }
        `,
	};

	constructor(props: DivProps = {}) {
		super();
		this.attr("class", "column");
		if (props.hAlign) {
			this.attr(
				"class",
				`halign-${alignToString(props.hAlign)}`,
				AttrMode.add,
			);
		}
		if (props.vAlign) {
			this.attr(
				"class",
				`valign-${alignToString(props.vAlign)}`,
				AttrMode.add,
			);
		}
	}

	build(): string {
		return /*html*/ `
            <div ${this.buildAttrs()}>
                ${super.build()}
            </div>
        `;
	}
}

export class Row extends Widget {
	static scripts: ScriptPackage = {
		id: "Row",
		css: /*css*/ `
            .row {
                display: flex;
                flex-direction: row;
                align-items: center;
            }
            .row > * {
                margin-right: 1em;
            }
            .row.valign-start {
                align-items: flex-start;
            }
            .row.valign-center {
                align-items: center;
            }
            .row.valign-end {
                align-items: flex-end;
            }
            .row.halign-start {
                justify-content: flex-start;
            }
            .row.halign-center {
                justify-content: center;
            }
            .row.halign-end {
                justify-content: flex-end;
            }
        `,
	};

	constructor(props: DivProps = {}) {
		super();
		this.attr("class", "row");
		if (props.hAlign) {
			this.attr(
				"class",
				`halign-${alignToString(props.hAlign)}`,
				AttrMode.add,
			);
		}
		if (props.vAlign) {
			this.attr(
				"class",
				`valign-${alignToString(props.vAlign)}`,
				AttrMode.add,
			);
		}
	}

	build(): string {
		return /*html*/ `
            <div ${this.buildAttrs()}>
                ${super.build()}
            </div>
        `;
	}
}

export class Grid extends Widget {
	static scripts: ScriptPackage = {
		id: "Grid",
		css: /*css*/ `
            .grid {
                display: grid;
                gap: .5rem;
                overflow: auto;
                align-self: stretch;
                align-items: center;
            }
        `,
	};

	constructor() {
		super();
		this.attr("class", "grid");
	}

	build(): string {
		return /*html*/ `
            <div ${this.buildAttrs()}>
                ${super.build()}
            </div>
        `;
	}
}
