import type { Disposable, WebviewPanel } from 'vscode';
import { Uri, ViewColumn, window } from 'vscode';
import { getAsset } from '../config';
import type { Option } from '../utils/monads';
import { None, Some } from '../utils/monads';
import { importCodiconToolkit, importWebviewToolkit } from '../utils/utils';

export type Args = any;
interface Message {
	cmd: string;
	args: Args;
}
type Handler = (panel: Panel, params: Args) => void;
type WidgetEventID = 'mount' | 'unmount';

export interface ScriptPackage {
	id: string;
	requires?: string[];
	js?: string;
	css?: string;
	setup?: (panel: Panel) => void;
}

interface EventListener {
	immediate?: (w: Widget) => boolean;
	listeners: ((w: Widget) => void)[];
}

export enum AttrMode {
	set,
	add,
	remove,
}

export interface WidgetProps {
	ariaLabel?: string;
	hoverText?: string;
}

export abstract class Widget {
	#panel?: Panel;
	#parent?: Widget;
	#children: Widget[] = [];
	#id?: string;
	#attrs: { [key: string]: string } = {};
	#handlers: { [cmd: string]: Handler } = {};
	#mounted = false;
	#built = false;
	#eventListeners: { [cmd: string]: EventListener } = {
		mount: {
			immediate: (w: Widget) => w.#mounted,
			listeners: [],
		},
		unmount: {
			listeners: [],
		},
	};

	constructor(props?: WidgetProps) {
		if (props?.hoverText) {
			this.attr('title', props.hoverText);
			this.attr('aria-label', props.hoverText);
		}
		if (props?.ariaLabel)
			this.attr('aria-label', props.ariaLabel);
	}

	private unmounted() {
		if (this.#mounted) {
			this.#mounted = false;
			this.dispatchEvent('unmount');
		}
	}

	private mounted() {
		if (!this.#mounted) {
			this.#mounted = true;
			this.dispatchEvent('mount');
		}
	}

	setPanel(panel?: Panel) {
		// clean up old panel
		if (this.#panel !== panel) {
			this.removeHandlersFromPanel();
			this.unmounted();
		}

		// set new panel
		this.#panel = panel;
		if (panel && !panel.isRegisteredWidgetType(this.constructor.name))
			console.warn(`Unregistered Widget type '${this.constructor.name}'`);

		// propagate down
		for (const child of this.#children)
			child.setPanel(panel);

		// set up stuff
		if (panel) {
			if (!this.#id) {
				this.#id = panel.createUniqueID();
				this.attr('widget-id', this.#id);
			}
			this.addHandlersToPanel();
		}
	}

	add(child: Widget | undefined): Widget {
		if (child) {
			if (child.#parent)
				child.#parent.remove(child);

			this.#children.push(child);
			child.#parent = this;
			child.setPanel(this.#panel);
			if (this.#built)
				this.#panel?.update(this, { add: child });
		}
		return this;
	}

	remove(child: Widget | undefined): Widget {
		if (child && this.#children.includes(child)) {
			this.#children.splice(this.#children.indexOf(child), 1);
			child.#parent = undefined;
			child.setPanel(undefined);
			child.dispatchEvent('unmount');
			if (this.#built)
				this.#panel?.update(this, { remove: child });
		}
		return this;
	}

	clear(): Widget {
		const shouldRebuild = this.#children.length > 0;
		this.#children.forEach((child) => {
			child.#parent = undefined;
			child.setPanel(undefined);
			child.dispatchEvent('unmount');
		});
		this.#children = [];
		if (shouldRebuild)
			this.rebuild();

		return this;
	}

	getChildren(): Widget[] {
		return this.#children;
	}

	getChild(id: string, recursive: boolean = false): Option<Widget> {
		for (const child of this.#children)
			if (child.getID() === id) {
				return Some(child);
			}
			else if (recursive) {
				const c = child.getChild(id, recursive);
				if (c)
					return Some(c);
			}

		return None;
	}

	getParent(): Option<Widget> {
		return this.#parent;
	}

	getPanel(): Option<Panel> {
		return this.#panel;
	}

	hasAncestor(ancestor: Widget): boolean {
		if (this.#parent) {
			if (this.#parent.#id === ancestor.#id)
				return true;

			return this.#parent.hasAncestor(ancestor);
		}
		return false;
	}

	addHandlerClass(id: string): Widget {
		if (!('register-handlers' in this.#attrs))
			this.#attrs['register-handlers'] = id;
		else
			this.#attrs['register-handlers'] += `,${id}`;

		return this;
	}

	getID(): Option<string> {
		return this.#id;
	}

	attr<T extends { toString: () => string }>(
		key: string,
		value: Option<T>,
        mode: AttrMode = AttrMode.set,
	): Widget {
		switch (mode) {
			case AttrMode.set:
				if (value)
					this.#attrs[key] = value.toString();
				else delete this.#attrs[key];
				break;

			case AttrMode.add:
				if (value)
					if (!(key in this.#attrs))
						this.#attrs[key] = value.toString();
					else
						this.#attrs[key] += ` ${value.toString()}`;
				break;

			case AttrMode.remove:
				if (value) {
					const val = value.toString();
					while (this.#attrs[key].includes(val))
						this.#attrs[key].replace(val, '');
				}
				break;
		}
		return this;
	}

	getAttr(key: string): Option<string> {
		if (key in this.#attrs)
			return Some(this.#attrs[key]);
		else
			return None;
	}

	protected addHandler(id: string, handler: Handler) {
		this.#handlers[id] = handler;
	}

	private realHandlerID(id: string) {
		// replace {id} in handler ID
		while (id.includes('{id}'))
			id = id.replace('{id}', this.#id ?? '');

		// replace {#attr} in handler ID
		for (const [key, value] of Object.entries(this.#attrs))
			while (id.includes(`{#${key}}`))
				id = id.replace(`{#${key}}`, value);

		return id;
	}

	private addHandlersToPanel() {
		this.#panel?.addHandler(`mounted-${this.getID()}`, (_) => {
			this.mounted();
		});
		// empty object
		if (!Object.keys(this.#handlers).length)
			return;

		if (this.#panel && this.#id)
			for (const [id, hnd] of Object.entries(this.#handlers))
				this.#panel.addHandler(this.realHandlerID(id), hnd);

		else
			console.warn(`Unable to add handlers for widget!`);
	}

	private removeHandlersFromPanel() {
		this.#panel?.removeHandler(`mounted-${this.#id}`);
		// empty object
		if (!Object.keys(this.#handlers).length)
			return;

		if (this.#panel)
			for (const [id, _] of Object.entries(this.#handlers))
				this.#panel.removeHandler(this.realHandlerID(id));
	}

	rebuild() {
		this.unmounted();
		this.#panel?.update(this);
	}

	on(eventID: WidgetEventID, handler: (widget: Widget) => void): Widget {
		this.#eventListeners[eventID].listeners.push(handler);
		const immediate = this.#eventListeners[eventID].immediate;
		if (immediate && immediate(this))
			handler(this);

		return this;
	}

	protected dispatchEvent(id: WidgetEventID) {
		this.#eventListeners[id].listeners.forEach(f => f(this));
	}

	protected buildAttrs(): string {
		return Object.entries(this.#attrs).map(
			([k, v]) => `${k}='${v}'`,
		).join(' ');
	}

	// if a child doesn't call super.build(), it should call this
	protected built() {
		this.#built = true;
	}

	protected isBuilt(): boolean {
		return this.#built;
	}

	build(): string {
		this.#built = true;
		return this.#children.map(w => w.build()).join('');
	}
}

export interface PanelProps {
	id: string;
	title: string;
	lightIcon?: string;
	darkIcon?: string;
	scripts?: ScriptPackage[];
}

export interface UpdateFull {
	full: undefined;
}
export interface UpdateAdd {
	add: Widget;
}
export interface UpdateRemove {
	remove: Widget;
}
export type Update = UpdateFull | UpdateAdd | UpdateRemove;

export abstract class Panel extends Widget {
	readonly #panel: WebviewPanel;
	readonly #title: string;
	readonly #scripts: ScriptPackage[];
	protected disposables: Disposable[] = [];
	#verifiedScripts: ScriptPackage[] = [];
	#handlers: { [cmd: string]: Handler } = {};
	#uniqueIDCounter = 0;
	#queuedUpdates: { [id: string]: { child: Widget; updates: Update[] } } = {};

	protected constructor(props: PanelProps) {
		super();

		this.#panel = window.createWebviewPanel(
			props.id,
			props.title,
			ViewColumn.Active,
			{ enableScripts: true },
		);
		this.#panel.iconPath = {
			light: Uri.file(getAsset(props.lightIcon)),
			dark: Uri.file(getAsset(props.darkIcon)),
		};
		this.#panel.onDidDispose(this.dispose, this, this.disposables);

		this.#title = props.title;
		this.#scripts = props.scripts ?? [];

		this.#panel.webview.onDidReceiveMessage(
			msg => this.handleMessage(msg),
			undefined,
			this.disposables,
		);

		this.setPanel(this);
	}

	createUniqueID(): string {
		return `widget${this.#uniqueIDCounter++}`;
	}

	isRegisteredWidgetType(type: string): boolean {
		return this.#scripts.find(c => c.id === type) !== undefined;
	}

	post(cmd: string, args: Args) {
		this.#panel.webview.postMessage({ cmd, args });
	}

	private doPostUpdate(child: Widget) {
		const id = child.getID() as string;

		// if a full rebuild was requested, do one of those
		if (this.#queuedUpdates[id].updates.some(type => 'full' in type)) {
			this.post('update-widget-full', {
				id,
				to: child.build(),
			});
		}
		// otherwise collect list of added and removed children and
		// post those
		else {
			interface Add { type: 'add'; data: string }
			interface Remove { type: 'remove'; id: string }

			const changes: (Add | Remove)[] = [];
			this.#queuedUpdates[id].updates.forEach((type) => {
				if ('add' in type)
					changes.push({
						type: 'add',
						data: type.add.build(),
					});
				else if ('remove' in type)
					changes.push({
						type: 'remove',
						id: type.remove.getID() as string,
					});
			});
			this.post('update-widget', { id, changes });
		}
		delete this.#queuedUpdates[id];
	}

	private filterUpdates() {
		for (const [_, u1] of Object.entries(this.#queuedUpdates))
			for (const [id, u2] of Object.entries(this.#queuedUpdates))
			// if a parent has a full rebuild queued, then any child updates
			// are redundant
				if (
					u1.updates.some(u => 'full' in u)
					&& u2.child.hasAncestor(u1.child)
				)
					delete this.#queuedUpdates[id];
	}

	update(child: Widget, type: Update = { full: undefined }): boolean {
		const id = child.getID();
		if (this.isBuilt() && id) {
			// we want to avoid full rebuilds as much as possible
			// luckily thanks to how the event loop works, the setTimeout call
			// will only be dispatched once all immediate code has finished
			// running, so subsequent Widget.rebuild()-calls will be queued to
			// be sent as a single update message at once

			const createTimeout = !(id in this.#queuedUpdates);
			if (createTimeout)
				this.#queuedUpdates[id] = {
					child,
					updates: [],
				};

			this.#queuedUpdates[id].updates.push(type);

			this.filterUpdates();

			if (createTimeout)
				setTimeout(() => this.doPostUpdate(child));

			return true;
		}
		return false;
	}

	addHandler(id: string, handler: Handler): void {
		this.#handlers[id] = handler;
	}

	removeHandler(id: string): void {
		delete this.#handlers[id];
	}

	private handleMessage(msg: Message) {
		if (msg.cmd in this.#handlers)
			this.#handlers[msg.cmd](this, msg.args);
		else if (!msg.cmd.startsWith('mounted-'))
			console.warn(`Unknown message command ${msg.cmd}!`);
	}

	protected onDispose?(): void;

	private dispose() {
		if (this.onDispose)
			this.onDispose();

		this.#panel.dispose();
		this.disposables.forEach(d => d.dispose());
		this.disposables = [];
	}

	show(where: ViewColumn): Panel {
		if (!this.isBuilt())
			this.#panel.webview.html = this.build();

		this.#panel.reveal(where);
		return this;
	}

	close() {
		this.dispose();
	}

	private verifyScriptPackages() {
		const verified: ScriptPackage[] = [];
		this.#scripts.forEach((s) => {
			// make sure required dependency scripts are all in the list
			if (s.requires)
				for (const r of s.requires)
					if (!verified.some(s => s.id === r)) {
						console.warn(
                            `Unable to add script package ${s.id} - `
                            + `missing required dependency ${r}`,
						);
						return undefined;
					}

			// remove duplicates
			if (verified.some(v => v.id === s.id))
				return undefined;

			verified.push(s);
			return s;
		});
		this.#verifiedScripts = verified;
	}

	private buildScript(): string {
		return /* javascript */ `
            const vscode = acquireVsCodeApi();
            
            const registerHandlers = {};
            function onRegister(id, handler) {
                registerHandlers[id] = handler;
            }
            
            const messageHandlers = {};
            function onMessage(id, handler) {
                messageHandlers[id] = handler;
            }

            function post(cmd, args) {
                vscode.postMessage({ cmd, args });
            }

            function getWidget(id, parent = document) {
                return parent.querySelector("[widget-id='" + id + "']");
            }

            function getWidgetID(node) {
                return node.getAttribute('widget-id');
            }

            // widget scripts
            ${this.#verifiedScripts.map(s => s.js).filter(s => s).join('')}

            // convert HTML string to an element
            async function htmlToElement(html) {
                const template = document.createElement('template');
                html = html.trim();
                template.innerHTML = html;
                return template.content.firstChild;
            }

            // add handlers to node
            function updateHandlers(node) {
                for (const id of node.getAttribute('register-handlers').split(',')) {
                    if (id in registerHandlers) {
                        registerHandlers[id](node);
                    } else {
                        console.warn("Unknown handler '" + id + "'");
                    }
                }
            }

            function updateNode(node) {
                node.querySelectorAll('[register-handlers]')
                    .forEach(w => updateHandlers(w));
                if (node !== document) {
                    if (node.getAttribute('register-handlers')) {
                        updateHandlers(node);
                    }
                    post('mounted-' + getWidgetID(node), undefined);
                }
                node.querySelectorAll('[widget-id]')
                    .forEach(w => post('mounted-' + getWidgetID(w), undefined));
            }

            window.addEventListener('load', () => {
                updateNode(document);
            });

            onMessage('update-widget-full', async args => {
                const node = getWidget(args.id);
                if (node) {
                    const newNode = await htmlToElement(args.to);
                    node.parentNode.replaceChild(newNode, node);
                    updateNode(newNode);
                } else {
                    console.error('No element ' + args.id + ' found');
                }
            });

            onMessage('update-widget', async args => {
                const node = getWidget(args.id);
                if (node) {
                    for (const change of args.changes) {
                        switch (change.type) {
                            case 'add': {
                                const newNode = await htmlToElement(change.data);
                                node.appendChild(newNode);
                                updateNode(newNode);
                            } break;

                            case 'remove': {
                                const rem = getWidget(change.id, node);
                                if (rem) {
                                    node.removeChild(rem);
                                }
                            } break;
                        }
                    }
                } else {
                    console.error('No element ' + args.id + ' found');
                }
            });

            window.addEventListener('message', e => {
                if (e.data.cmd in messageHandlers) {
                    messageHandlers[e.data.cmd](e.data.args);
                } else {
                    console.warn("Unknown message command '" + e.data.cmd + "'");
                }
            });
        `;
	}

	build(): string {
		this.verifyScriptPackages();
		this.#verifiedScripts.forEach((s) => {
			if (s.setup)
				s.setup(this);
		});
		return /* html */ `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    ${importWebviewToolkit(this.#panel.webview)}
                    ${importCodiconToolkit(this.#panel.webview)}
                    <script defer>
                        (function() {
                            ${this.buildScript()}
                        }());
                    </script>
                    <!-- widget styles -->
                    <style>
                        ${this.#verifiedScripts.map(s => s.css).filter(s => s).join('')}
                    </style>
                    <title>${this.#title}</title>
                </head>
                <body ${super.buildAttrs()}>
                    ${super.build()}
                </body>
            </html>
        `;
	}
}
