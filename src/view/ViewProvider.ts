import { Uri, Webview, WebviewView, WebviewViewProvider } from "vscode";
import { getExtContext } from "../config";
import { Widget, WidgetProperties } from "./Widget";
import { Option } from "../utils/monads";
import { Package, Resources } from "./Package";

export interface Message {
	cmd: string;
	args: any;
}

export type Handler<T> = (args: T) => any;

export class ViewProvider extends Widget implements WebviewViewProvider {

    public static readonly INSTANCES: ViewProvider[] = [];

    public static readonly RESOURCES = Resources.fromResources({
        css: `
            :root {
                --item-width: minmax(11rem, 1fr);
                --item-height: 13rem;
            }

            html {
                height: 100%;
            }

            body {
                display: flex;
                align-items: stretch;
                flex-direction: column;
                height: 100%;
                user-select: none;
            }
        `,
        js: `
            const vscode = acquireVsCodeApi();
            const registrationIDs = {};
            const globalClickListeners = [];
            const messageHandlers = {};
            const intersectionObservers = {};
            let lastClickedX = 0;
            let lastClickedY = 0;

            function onRegister(id, handler) {
                registrationIDs[id] = handler;
            }

            function onMessage(id, handler) {
                messageHandlers[id] = handler;
            }

            function post(cmd, args) {
                vscode.postMessage({ cmd, args });
            }

            function getWidget(id, parent = document) {
                return parent.querySelector(\`[widget-id="\${id}"]\`);
            }

            function getWidgetID(node) {
                return node.getAttribute("widget-id");
            }

            function getWidgetIDRecursive(node) {
                if (node.hasAttribute("widget-id")) {
                    return node.getAttribute("widget-id");
                } else if (node.parentNode) {
                    return getWidgetIDRecursive(node.parentNode);
                }
            }

            // Convert HTML string to an element
            async function htmlToElement(html) {
                const template = document.createElement("template");
                html = html.trim();
                template.innerHTML = html;

                return template.content.firstChild;
            }

            // Add handlers to node
            function updateRegistrations(node) {
                const registered = node.getAttribute("register-handlers");

                if (!registered) return;

                for (const id of registered.split(",")) {
                    if (id in registrationIDs) {
                        registrationIDs[id](node);
                    } else {
                        console.warn(\`Unknown handler '\${id}'\`);
                    }
                }
            }

            function updateNode(node) {
                node.querySelectorAll("[register-handlers]").forEach((handler) => updateRegistrations(handler));

                if (node != document) {
                    updateRegistrations(node);
                }
            }

            function onGlobalClick(callback) {
                globalClickListeners.push(callback);
            }

            window.addEventListener("load", () => updateNode(document));

            onMessage("update-widget", async ({ id, reason, args }) => {
                let node = getWidget(id);

                if (args.forPart) {
                    node = node.querySelector(\`[widget-part="\${args.forPart}"]\`);
                }

                if (node) {
                    switch (reason) {
                        case "added-attribute": {
                            node.setAttribute(args.attribute, args.value);

                            if (args.name == "register-handlers") {
                                updateRegistrations(node);
                            }
                        } break;
                        case "removed-attribute": {
                            node.removeAttribute(args.attribute);
                        } break;
                        case "added-child": {
                            const newNode = await htmlToElement(args.html);

                            node.appendChild(newNode);
                            updateNode(newNode);
                        } break;
                        case "removed-child": {
                            const target = getWidget(args.id, node);

                            if (target) {
                                target.parentNode.removeChild(target);
                            }
                        } break;
                        case "set-text": {
                            if (node.firstChild instanceof Text) {
                                node.firstChild.nodeValue = args.text;
                            } else {
                                node.prepend(document.createTextNode(args.text));
                            }
                        } break;
                    }
                } else {
                    console.error(\`No element '\${args.id}' found\`);
                }
            });

            onMessage("create-observer", (args) => {
                const root = getWidget(args.root);

                if (root) {
                    const observer = {
                        root,
                        int: new IntersectionObserver((entries) => post(\`visibility-changed-\${args.id}\`, {
                            entries: entries.map((entry) => ({
                                id: getWidgetID(entry.target),
                                visible: entry.isIntersecting
                            }))
                        }), {
                            threshold: 0.1
                        }),
                        // Detect when children are added to root and update intersectionobserver accordingly
                        mut: new MutationObserver((mutations) => mutations.forEach((mutation) => {
                            if (mutation.type == "childList") {
                                mutation.addedNodes.forEach((node) => observer.int.observe(node));
                                mutation.removedNodes.forEach((node) => observer.int.unobserve(node));
                            }
                        }))
                    };

                    observer.mut.observe(root, {
                        childList: true
                    });

                    [...root.children].forEach((node) => observer.int.observe(node));
                    intersectionObservers[args.id] = observer;
                } else {
                    console.warn(\`Element '\${args.root}' not found, unable to create observer!\`);
                }
            });

            onMessage("remove-observer", (args) => {
                if (args.id in intersectionObservers) {
                    intersectionObservers[args.id].mut.disconnect();
                    intersectionObservers[args.id].int.disconnect();

                    delete intersectionObservers[args.id];
                }
            });

            onMessage("reconnect-observers", () => {
                for (const id in intersectionObservers) {
                    mut.unobserve(root);
                    mut.observe(root, {
                        childList: true
                    });

                    [...root.children].forEach((node) => {
                        int.unobserve(node);
                        int.observe(node);
                    });
                }
            });

            onMessage("inject-package", ({ css, js }) => {
                if (css) {
                    const style = document.createElement("style");

                    style.innerHTML = css;

                    document.head.appendChild(style);
                }

                if (js) {
                    // Ye I know eval is bad, shut.
                    eval(js);
                }
            });

            document.addEventListener("click", (event) => {
                lastClickedX = event.clientX;
                lastClickedY = event.clientY;

                globalClickListeners.forEach((callback) => callback(event));
            });

            window.addEventListener("message", (event) => {
                if (event.data.cmd in messageHandlers) {
                    messageHandlers[event.data.cmd](event.data.args);
                } else {
                    console.warn(\`Unknown message command '\${event.data.cmd}'\`);
                }
            });
        `
    });

    protected static getWebviewUri(webview: Webview, ...paths: string[]) {
        return webview.asWebviewUri(
            Uri.joinPath(getExtContext().extensionUri, ...paths),
        );
    }

    private static importWebviewToolkit(webview: Webview) {
        return /*html*/ `
            <script type="module" src="${ViewProvider.getWebviewUri(webview, "node_modules/@vscode/webview-ui-toolkit/dist/toolkit.min.js")}"></script>
        `;
    }

    private static importCodiconToolkit(webview: Webview) {
        return /*html*/ `
            <link href="${ViewProvider.getWebviewUri(webview, "node_modules/@vscode/codicons/dist/codicon.css")}" rel="stylesheet" />
        `;
    }

    protected view?: WebviewView;

    protected ready: boolean;

    protected pagePostQueue: { cmd: string; args: any }[];

    protected readonly handlers: Map<string, Handler<any>>;

    // Enforces that there's always at least one view
    constructor(properties: WidgetProperties = {}) {
        properties.id ??= "root";

        super(properties);

        this.ready = false;
        this.pagePostQueue = [];
        this.handlers = new Map();
        ViewProvider.INSTANCES.push(this);
    }

    public override post(cmd: string, args: any): this {
        if (this.ready && this.view) {
            this.view.webview.postMessage({ cmd, args });
        } else {
            this.pagePostQueue.push({ cmd, args });
        }

        return this;
    }

    public override registerHandler<T>(id: string, handler: Handler<T>): string {
        this.handlers.set(id, handler);

        return id;
    }

    public override unregisterHandler(id: string): this {
        this.handlers.delete(id);

        return this;
    }

    public invokeHandler(message: Message): ViewProvider {
        if (this.handlers.has(message.cmd)) {
            this.handlers.get(message.cmd)!(message.args);
        } else {
            console.warn(`No handler for ${message.cmd}`);
        }

        return this;
    }

    public addPackage(widgetPackage: Package): this {
        const toBeAdded = this.getPackage().getToBeAdded(widgetPackage);

        this.getPackage().merge(widgetPackage);
        this.post("inject-package", {
            css: toBeAdded.getCSS(),
            js: toBeAdded.getJS()
        });

        return this;
    }

    public reload(): this {
        if (this.view) {
            this.getChildren().forEach((child) => this.replaceChild(child, child));
        }

        return this;
    }

    public override init(provider: ViewProvider): string {
        try {
            return super.init(provider);
        } catch (error) {
            return `<body><h1>Critical Error: Unable to load view</h1><p>${error}</p></body>`;
        }
    }

    public override build(): string {
        const widgetPackage = this.getPackage();

        return /*html*/ `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    ${ViewProvider.importWebviewToolkit(this.view!.webview)}
                    ${ViewProvider.importCodiconToolkit(this.view!.webview)}
                    <script defer>
                        (async () => {
                            ${widgetPackage.getJS()}

                            post("ready", {});
                        })();
                    </script>
                    <style>
                        ${widgetPackage.getCSS()}
                    </style>
                </head>
                <body ${this.getFormattedAttributes()}>
                    ${this.buildChildren()}
                </body>
            </html>
        `;
    }

    public resolveWebviewView(webviewView: WebviewView): void | Thenable<void> {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true
        };

        webviewView.onDidDispose(this.dispose, this);
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.propegateAction((widget) => widget.onShow?.(), true);
            } else {
                this.propegateAction((widget) => widget.onHide?.(), true);
            }
        });
        webviewView.webview.onDidReceiveMessage((message: Message) => {
            // I sure do hope this comes before everything else...
            if (message.cmd == "ready") {
                this.ready = true;

                this.pagePostQueue.forEach(({ cmd, args }) => this.post(cmd, args));

                this.pagePostQueue = [];
            } else {
                this.invokeHandler(message);
            }
        });

        webviewView.webview.html = this.init(this);
    }

    public getView(): Option<WebviewView> {
        return this.view;
    }

    public getWebview(): Option<Webview> {
        return this.view?.webview;
    }

    public override dispose(): this {
        this.ready = false;
        this.pagePostQueue = [];

        return super.dispose();
    }
}