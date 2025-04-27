import { Widget, ScriptPackage, Panel, WidgetProps, AttrMode } from "./Widget";
import { sha1 } from "object-hash";
import { Codicon } from "./Icon";
import { None, Option, Result } from "../utils/monads";
import { Badge, LoadingCircle } from "./Basic";
import { Uri, window } from "vscode";
import { rmSync } from "fs";

export interface ButtonProps extends WidgetProps {
	startIcon?: Codicon;
	endIcon?: Codicon;
	onClick?: (panel: Panel) => void;
}

export interface IconButtonProps extends WidgetProps {
	icon?: Codicon;
	onClick?: (panel: Panel) => void;
}

export class Button extends Widget {
	#title?: string;
	#icon?: Codicon;
	#startIcon?: Codicon;
	#endIcon?: Codicon;

	static scripts: ScriptPackage = {
		id: "Button",
		js: /*javascript*/ `
            onRegister('button', w => {
                w.addEventListener('click', e => {
                    post(
                        'button-' + getWidgetID(e.target),
                        undefined
                    );
                });
            });
        `,
	};

	constructor(title: string, props?: ButtonProps);
	constructor(props: IconButtonProps);

	constructor(title: string | IconButtonProps, props?: ButtonProps) {
		super(typeof title === "string" ? props : title);
		if (typeof title === "string") {
			this.#title = title;
			this.#startIcon = props?.startIcon;
			this.#endIcon = props?.endIcon;
			if (props?.onClick) {
				this.addHandlerClass("button");
				this.addHandler("button-{id}", props.onClick);
			}
		} else {
			this.#icon = title.icon;
			this.attr("appearance", "icon");
			if (title.onClick) {
				this.addHandlerClass("button");
				this.addHandler("button-{id}", title.onClick);
			}
		}
	}

	setTitle(title: string) {
		this.#title = title;
		this.rebuild();
	}

	build(): string {
		return /*html*/ `
            <vscode-button ${this.buildAttrs()}>
                ${this.#title ?? ""}
                ${
					this.#icon
						? `<span ${this.buildAttrs()} class="codicon codicon-${
								this.#icon
							}"></span>`
						: ""
				}
                ${
					this.#startIcon
						? `<span slot="start" class="codicon codicon-${
								this.#startIcon
							}"></span>`
						: ""
				}
                ${
					this.#endIcon
						? `<span slot="end" class="codicon codicon-${
								this.#endIcon
							}"></span>`
						: ""
				}
                ${super.build()}
            </vscode-button>
        `;
	}
}

export interface SelectProps extends WidgetProps {
	selected?: string;
	onChange?: (panel: Panel, value: string) => void;
}

export class Select extends Widget {
	#items: { id: string; name: string }[];

	static scripts: ScriptPackage = {
		id: "Select",
		js: /*javascript*/ `
            onRegister('select', w => {
                w.addEventListener('change', e => {
                    post(
                        'select-' + getWidgetID(e.target),
                        { value: e.target.value }
                    );
                });
            });
        `,
	};

	constructor(
		items: (string | { id: string; name: string })[],
		props: SelectProps = {},
	) {
		super(props);

		this.#items = items.map((i) =>
			typeof i === "string" ? { id: i, name: i } : i,
		);
		this.select(props.selected);

		this.addHandlerClass("select");
		this.addHandler("select-{id}", (panel, args) => {
			this.attr("value", args.value);
			if (props.onChange) {
				props.onChange(panel, args.value);
			}
		});
	}

	setItems(items: (string | { id: string; name: string })[]): Select {
		this.#items = items.map((i) =>
			typeof i === "string" ? { id: i, name: i } : i,
		);
		this.select(this.getSelected());
		this.rebuild();
		return this;
	}

	select(id: string | undefined): Select {
		if (id && this.#items.some((i) => i.id === id)) {
			this.attr("value", id);
		} else {
			this.attr("value", this.#items.at(0)?.id);
		}
		this.rebuild();
		return this;
	}

	getSelected(): string | undefined {
		return this.getAttr("value");
	}

	build(): string {
		return /*html*/ `
            <vscode-dropdown ${this.buildAttrs()}>
                ${this.#items
					.map(
						(i) => /*html*/ `
                    <vscode-option value='${i.id}'>${i.name}</vscode-option>
                `,
					)
					.join("")}
                ${super.build()}
            </vscode-dropdown>
        `;
	}
}

export interface TabProps extends WidgetProps {
	id: string;
	title: string;
	badge?: number;
	closable?: boolean;
	content?: Widget;
}

export class Tab extends Widget {
	#tabID: string;
	#title: string;
	#badge?: Badge;
	#content?: Widget;

	static scripts: ScriptPackage = {
		id: "Tab",
	};

	constructor(props: TabProps) {
		super(props);

		this.#tabID = props.id;
		this.#title = props.title;
		this.attr("id", this.#tabID);

		if (props.content) {
			this.add((this.#content = props.content));
		}
		if (props.badge) {
			this.add((this.#badge = new Badge(props.badge)));
		}
		if (props.closable) {
			this.add(
				new Button({
					icon: "close",
					onClick: (_) => {
						const parent = this.getParent();
						parent?.remove(this);
						if (parent instanceof Tabs) {
							parent.select(parent.getSelected());
						}
					},
				}),
			);
		}
	}

	badge(count: number | undefined): Tab {
		if (this.#badge) {
			this.remove(this.#badge);
			this.#badge = undefined;
		}
		if (count !== undefined) {
			this.add((this.#badge = new Badge(count)));
		}
		return this;
	}

	title(title: string | undefined): Tab {
		this.#title = title ?? this.#tabID;
		this.rebuild();
		return this;
	}

	getTabID(): string {
		return this.#tabID;
	}

	private buildNonContent() {
		return this.getChildren()
			.map((w) => (w.getID() !== this.#content?.getID() ? w.build() : ""))
			.join("");
	}

	build(): string {
		this.built();
		return /*html*/ `
            <vscode-panel-tab ${this.buildAttrs()}>
                ${this.#title}
                ${this.buildNonContent()}
            </vscode-panel-tab>
            <vscode-panel-view id='${this.#tabID}'>
                ${this.#content?.build() ?? ""}
            </vscode-panel-view>
        `;
	}
}

export interface TabsProps extends WidgetProps {
	selected?: string;
	onChange?: (panel: Panel, id: string) => void;
}

export class Tabs extends Widget {
	#onChange?: (panel: Panel, id: string) => void;
	#history: string[] = [];

	static scripts: ScriptPackage = {
		id: "Tabs",
		js: /*javascript*/ `
            onRegister('tabs', w => {
                w.addEventListener('change', e => {
                    post(
                        'tabs-' + getWidgetID(e.target),
                        { value: e.detail.getAttribute('id') }
                    );
                });
            });
        `,
	};

	constructor(tabs: TabProps[], props: TabsProps = {}) {
		super(props);
		tabs.forEach((p) => this.add(new Tab(p)));
		this.select(props.selected, false);
		this.#onChange = props.onChange;

		this.addHandlerClass("tabs");
		this.addHandler("tabs-{id}", (panel, args) => {
			this.attr("activeid", args.value);
			this.#history.push(args.value);
			if (this.#onChange) {
				this.#onChange(panel, args.value);
			}
		});
	}

	setTabs(tabs: TabProps[]): Tabs {
		this.clear();
		this.#history = [];
		tabs.forEach((p) => this.add(new Tab(p)));
		this.select(this.getSelected());
		this.rebuild();
		return this;
	}

	select(id: string | undefined, invokeCallback = true) {
		let selectedID;
		if (
			id &&
			this.getChildren().some(
				(tab) => tab instanceof Tab && tab.getTabID() === id,
			)
		) {
			selectedID = id;
		} else {
			while (this.#history.length) {
				const back = this.#history.pop();
				if (
					this.getChildren().some(
						(tab) => tab instanceof Tab && tab.getTabID() === back,
					)
				) {
					selectedID = back;
				}
			}
			if (!selectedID) {
				const first = this.getChildren().at(0);
				selectedID =
					first instanceof Tab ? first.getTabID() : undefined;
			}
		}
		this.attr("activeid", selectedID);
		if (selectedID) {
			this.#history.push(selectedID);
		}
		// #safe
		if (invokeCallback && this.getPanel() && this.#onChange && selectedID) {
			this.#onChange(this.getPanel() as Panel, selectedID);
		}
		this.rebuild();
	}

	getSelected(): string | undefined {
		return this.getAttr("activeid");
	}

	title(tabID: string, newTitle: string): Tabs {
		this.getChildren().forEach((tab) => {
			if (tab instanceof Tab && tab.getTabID() === tabID) {
				tab.title(newTitle);
			}
		});
		return this;
	}

	badge(tabID: string, count: number): Tabs {
		this.getChildren().forEach((tab) => {
			if (tab instanceof Tab) {
				if (tab.getTabID() === tabID) {
					tab.badge(count);
				}
			}
		});
		return this;
	}

	build(): string {
		return /*html*/ `
            <vscode-panels ${this.buildAttrs()}>
                ${super.build()}
            </vscode-panels>
        `;
	}
}

export interface InputProps extends WidgetProps {
	focus?: boolean;
	maxlength?: number;
	placeholder?: string;
	size?: number;
	value?: string;
	label?: string;
	startIcon?: Codicon;
	endIcon?: Codicon;
	onChange?: (input: Input, value: string) => void;
}

export class Input extends Widget {
	#value?: string;
	#label?: string;
	#startIcon?: Codicon;
	#endIcon?: Codicon;

	static scripts: ScriptPackage = {
		id: "Input",
		js: /*javascript*/ `
            onRegister('input', w => {
                w.addEventListener('input', e => {
                    post(
                        'input-' + getWidgetID(e.target),
                        { value: e.target.value }
                    );
                });
            });
        `,
	};

	constructor(props: InputProps) {
		super(props);

		this.#label = props.label;
		this.#value = props.value;
		this.#startIcon = props.startIcon;
		this.#endIcon = props.endIcon;

		this.attr("autofocus", props.focus ?? false);
		this.attr("maxlength", props.maxlength ?? 255);
		this.attr("placeholder", props.placeholder);
		this.attr("size", props.size);
		this.attr("value", props.value);

		const onChange = props.onChange;
		this.addHandlerClass("input");
		this.addHandler("input-{id}", (_, args) => {
			this.#value = args.value;
			this.attr("value", args.value);
			if (onChange) {
				onChange(this, args.value);
			}
		});
	}

	getValue(): Option<string> {
		return this.#value;
	}

	setLabel(value: string) {
		this.#label = value;
		this.rebuild();
	}

	build(): string {
		return /*html*/ `
            <vscode-text-field ${this.buildAttrs()}>
                ${this.#label ?? ""}
                ${
					this.#startIcon
						? `<span slot="start" class="codicon codicon-${
								this.#startIcon
							}"></span>`
						: ""
				}
                ${
					this.#endIcon
						? `<span slot="end" class="codicon codicon-${
								this.#endIcon
							}"></span>`
						: ""
				}
                ${super.build()}
            </vscode-text-field>
        `;
	}
}

export interface AudioPlaybackProps extends WidgetProps {
	srcFile: string,
}

export class AudioPlayback extends Widget {
	#srcFile: string;
	#copiedWebviewUri: Option<Result<Uri>>;

	static scripts: ScriptPackage = {
		id: "AudioPlayback",
		js: /*javascript*/ ``,
		css: /*css*/ `
			audio {
				transform: scale(60%);
			}
		`,
	};

	constructor(props: AudioPlaybackProps) {
		super(props);
		this.#srcFile = props.srcFile;

		// Cleanup temporary file on unmount
		this.on("unmount", w => {
			if (this.#copiedWebviewUri && this.#copiedWebviewUri.isValue()) {
				try {
					rmSync(this.#copiedWebviewUri.unwrap().fsPath);
				}
				catch (_) {}
			}
		});
	}

	build(): string {
		this.#copiedWebviewUri = this.getPanel()?.copyAndGetWebviewFilePath(this.#srcFile);
		return /*html*/ `
			<div ${this.buildAttrs()}>
				${
					this.#copiedWebviewUri?.isValue() ? /*html*/ `
						<audio controls>
							<source src="${this.#copiedWebviewUri.unwrap()}">
						</audio>
					` : (this.#copiedWebviewUri ? /*html*/ `<p>Unable to load audio: ${this.#copiedWebviewUri?.unwrapErr()}</p>` : "")
				}
				${super.build()}
			</div>
        `;
	}
}

export interface IFrameProps extends WidgetProps {
    src: string;
}

export class IFrame extends Widget {
    public static scripts: ScriptPackage = {
        id: "IFrame"
    };

    constructor(props: IFrameProps) {
        super(props);

        this.attr("src", props.src);
    }

    public build(): string {
        return /*html*/ `
            <iframe ${this.buildAttrs()}>
                ${super.build()}
            </iframe>
        `;
    }
}