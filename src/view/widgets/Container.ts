import { Resources } from "../Package";
import { MergeProperties, Widget, WidgetProperties } from "../Widget";
import { Element } from "./Basic";
import { Size, SizeUnit, getSizeString } from "./types/Size";

export enum Alignment {
    START = "start",
    CENTER = "center",
    END = "end",
}

export type LayoutProperties = MergeProperties<{
    vAlign?: Alignment;
    hAlign?: Alignment;
    spacing?: Size;
}>;

export class Div extends Element {

    constructor(properties?: WidgetProperties) {
        super(Widget.mergeProperties({
            tag: "div"
        }, properties));
    }
}

export class PaddedDiv extends Div {

    public static readonly RESOURCES = Resources.fromCSS(`
        .padded-div {
            padding: 1rem;
        }
    `);

    constructor(properties?: WidgetProperties) {
        super(properties);

        this.addClass("padded-div");
    }
}

export class Column extends Div {

    public static readonly RESOURCES = Resources.fromCSS(`
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
    `);

    constructor(properties?: LayoutProperties) {
        super(properties);

        this.addClass("column");

        if (properties?.hAlign) {
            this.addClass(`halign-${properties.hAlign}`);
        }

        if (properties?.vAlign) {
            this.addClass(`valign-${properties.vAlign}`);
        }

        if (properties?.spacing) {
            this.setStyleOverride("gap", getSizeString(properties.spacing));
        }
    }
}

export class Row extends Div {

    public static readonly RESOURCES = Resources.fromCSS(`
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
    `);

    constructor(properties?: LayoutProperties) {
        super(properties);

        this.addClass("row");

        if (properties?.hAlign) {
            this.addClass(`halign-${properties.hAlign}`);
        }

        if (properties?.vAlign) {
            this.addClass(`valign-${properties.vAlign}`);
        }

        if (properties?.spacing) {
            this.setStyleOverride("gap", getSizeString(properties.spacing));
        }
    }
}

export class Spacer extends Div {

    protected width: Size;

    protected height: Size;

    constructor(properties: MergeProperties<{
        width: Size,
        height?: Size
    } | {
        width?: Size,
        height: Size
    }>) {
        super(properties);

        const defaultSize: Size = {
            amount: 100,
            unit: SizeUnit.PERCENT
        };

        this.setStyleOverride("width", getSizeString(this.width = properties.width ?? defaultSize));
        this.setStyleOverride("height", getSizeString(this.height = properties.height ?? defaultSize));
    }

    public getWidth(): Size {
        return this.width;
    }

    public setWidth(width: Size): this {
        return this.setStyleOverride("with", getSizeString(this.width = width));
    }

    public getHeight(): Size {
        return this.height;
    }

    public setHeight(height: Size): this {
        return this.setStyleOverride("height", getSizeString(this.height = height));
    }
}