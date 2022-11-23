
import { Widget, ScriptPackage, WidgetProps } from "./Widget";
import { sha1 } from 'object-hash';

export class Head extends Widget {
    #text: string;
    #size: number;

    static scripts: ScriptPackage = {
        id: 'Head'
    };
    
    constructor(text: string, size?: 1 | 2 | 3 | 4 | 5 | 6) {
        super();
        this.#text = text;
        this.#size = size ?? 1;
    }

    build(): string {
        return /*html*/ `
            <h${this.#size} ${this.buildAttrs()}>
                ${this.#text}
                ${super.build()}
            </h${this.#size}>
        `;
    }
}

export class Text extends Widget {
    #text: string;
    
    static scripts: ScriptPackage = {
        id: 'Text',
    };

    constructor(text: string) {
        super();
        this.#text = text;
    }

    setText(text: string) {
        this.#text = text;
        this.rebuild();
    }

    build(): string {
        return /*html*/ `
            <p ${this.buildAttrs()}>
                ${this.#text}
                ${super.build()}
            </p>
        `;
    }
}

export class Label extends Widget {
    #text: string;
    
    static scripts: ScriptPackage = {
        id: 'Label',
        css: /*css*/ `
            .label {
                display: block;
                color: var(--vscode-descriptionForeground);
            }
        `
    };

    constructor(text: string) {
        super();
        this.#text = text;
        this.attr('class', 'label');
    }

    setText(text: string) {
        this.#text = text;
        this.rebuild();
    }

    build(): string {
        return /*html*/ `
            <text ${this.buildAttrs()}>
                ${this.#text}
                ${super.build()}
            </text>
        `;
    }
}

export class LoadingCircle extends Widget {
    static scripts: ScriptPackage = {
        id: 'LoadingCircle',
    };

    constructor() {
        super();
    }

    build(): string {
        return /*html*/ `
            <vscode-progress-ring ${this.buildAttrs()}>
                ${super.build()}
            </vscode-progress-ring>
        `;
    }
}

export class Image extends Widget {
    #data: string;

    static scripts: ScriptPackage = {
        id: 'Image',
    };

    constructor(data: string) {
        super();
        this.#data = data;
        this.attr('src', `data:image/png;base64,${data}`);
    }

    setData(data: string): Image {
        this.#data = data;
        this.attr('src', `data:image/png;base64,${data}`);
        this.rebuild();
        return this;
    }

    build(): string {
        return /*html*/ `
            <img ${this.buildAttrs()}>
                ${super.build()}
            </img>
        `;
    }
}

export class Separator extends Widget {
    static scripts: ScriptPackage = {
        id: 'Separator',
    };

    constructor(props?: WidgetProps) {
        super(props);
    }

    build(): string {
        return /*html*/ `
            <hr ${this.buildAttrs()}>
                ${super.build()}
            </hr>
        `;
    }
}

export class Spacer extends Widget {
    static scripts: ScriptPackage = {
        id: 'Spacer',
    };

    constructor(size: string) {
        super();
        this.attr('style', `width: ${size}`);
    }

    build(): string {
        return /*html*/ `
            <div ${this.buildAttrs()}>
                ${super.build()}
            </div>
        `;
    }
}

export class Element extends Widget {
    #tag: string;

    static scripts: ScriptPackage = {
        id: 'Element',
    };

    constructor(tag: string) {
        super();
        this.#tag = tag;
    }

    build(): string {
        return /*html*/ `
            <${this.#tag} ${this.buildAttrs()}>
                ${super.build()}
            </${this.#tag}>
        `;
    }
}

export class Badge extends Widget {
    #count: number;

    static scripts: ScriptPackage = {
        id: 'Badge',
    };

    constructor(count: number) {
        super();
        this.#count = count;
    }

    getCount(): number {
        return this.#count;
    }

    build(): string {
        return /*html*/ `
            <vscode-badge ${this.buildAttrs()}>
                ${this.#count}
                ${super.build()}
            </vscode-badge>
        `;
    }
}

export class DataGridCell extends Widget {
    #text: string;

    static scripts: ScriptPackage = {
        id: 'DataGridCell',
    };

    constructor(text: string, props?: WidgetProps) {
        super(props);
        this.#text = text;
    }

    build(): string {
        return /*html*/ `
            <vscode-data-grid-cell ${this.buildAttrs()}>
                ${this.#text}
                ${super.build()}
            </vscode-data-grid-cell>
        `;
    }
}

export class DataGridRow extends Widget {
    static scripts: ScriptPackage = {
        id: 'DataGridRow',
    };

    constructor(props?: WidgetProps) {
        super(props);
    }

    build(): string {
        return /*html*/ `
            <vscode-data-grid-row ${this.buildAttrs()}>
                ${super.build()}
            </vscode-data-grid-row>
        `;
    }
}

export class DataGrid extends Widget {
    static scripts: ScriptPackage = {
        id: 'DataGrid',
    };

    constructor(props?: WidgetProps) {
        super(props);
    }

    build(): string {
        return /*html*/ `
            <vscode-data-grid ${this.buildAttrs()}>
                ${super.build()}
            </vscode-data-grid>
        `;
    }
}
