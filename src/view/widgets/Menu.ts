import { Resources } from "../Package";
import { GetWidgetProperties, MergeProperties, Widget } from "../Widget";
import { Button } from "./Button";
import { Column } from "./Container";

export class MenuItem extends Button {

    public static readonly RESOURCES = Resources.fromCSS(`
        .menu-item {
            background-color: transparent;
            border-radius: 5px;
        }

        .menu-item::part(control) {
            border: none;
        }

        .menu-item:hover {
            background-color: var(--button-primary-background);
        }
    `);

    constructor(properties: GetWidgetProperties<typeof Button>) {
        super(properties);

        this.addClass("menu-item");
    }
}

export class Menu extends Column {

    public static readonly RESOURCES = Resources.fromResources({
        css: `
            .menu {
                position: absolute;
                background: var(--vscode-menu-background);
                color: var(--vscode-menu-foreground);
                border: 1px solid var(--vscode-menu-border);
                box-shadow: 0 0 1rem var(--vscode-widget-shadow);
                border-radius: 8px;
                padding: 0.3rem;
            }
        `,
        js: `
            let menuListeners = [];

            onRegister("menu", (widget) => {
                let x = lastClickedX;
                let y = lastClickedY;
                const size = widget.getBoundingClientRect();
                const winSize = document.body.getBoundingClientRect();

                menuListeners.push(getWidgetID(widget));

                // make sure menu doesn't go outside window
                while (x + size.width > winSize.width) {
                    x -= size.width;
                }

                while (y + size.height > winSize.height) {
                    y -= size.height;
                }

                widget.style.top = y.toString() + "px";
                widget.style.left = x.toString() + "px";
            });

            onGlobalClick(() => {
                menuListeners.forEach((id) => post(\`close-menu-\${id}\`, undefined));
                menuListeners = [];
            });
        `
    });

    constructor(properties: MergeProperties<{
        items: GetWidgetProperties<typeof MenuItem>[],
    }, GetWidgetProperties<typeof Column>>) {
        super(Widget.mergeProperties({
            children: properties.items.map((item) => new MenuItem(item))
        }, properties));

        this.addClass("menu");
        this.addRegistrationID("menu");
        this.registerHandler("close-menu-{id}", () => this.getParent()?.removeChild(this));
    }
}