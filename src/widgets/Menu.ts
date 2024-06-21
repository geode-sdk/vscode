import { Column, DivProps } from "./Container";
import { Button, ButtonProps } from "./Interactive";
import { AttrMode, Panel, ScriptPackage, Widget } from "./Widget";

export interface MenuItemProps extends ButtonProps {
	onClick?: (panel: Panel) => void;
}

export class MenuItem extends Button {
	static scripts: ScriptPackage = {
		id: "MenuItem",
		css: /*css*/ `
            .menu-item {
                background-color: transparent;
                border: 1px solid transparent;
            }

            .menu-item:hover {
                background-color: var(--vscode-menubar-selectionBackground);
                border: 1px solid var(--vscode-menubar-selectionBorder);
            }
        `,
	};

	constructor(name: string, props?: MenuItemProps) {
		super(name, props);
		this.attr("class", "menu-item", AttrMode.add);
	}
}

export interface MenuItemValue extends MenuItemProps {
	name: string;
}

export interface MenuProps extends DivProps {}

export class Menu extends Column {
	static scripts: ScriptPackage = {
		id: "Menu",
		requires: ["_globalClickListener"],
		css: /*css*/ `
            .menu {
                position: absolute;
                background: var(--vscode-menu-background);
                color: var(--vscode-menu-foreground);
                border: 1px solid var(--vscode-menu-border);
                padding: .1em;
                box-shadow: 0 0 1rem var(--vscode-widget-shadow);
            }
        `,
		js: /*javascript*/ `
            let lastClickedX = 0;
            let lastClickedY = 0;

            onRegister('menu', m => {
                let x = lastClickedX;
                let y = lastClickedY;

                const size = m.getBoundingClientRect();
                const winSize = document.body.getBoundingClientRect();
        
                // make sure menu doesn't go outside window
                while (x + size.width > winSize.width) {
                    x -= size.width;
                }
                while (y + size.height > winSize.height) {
                    y -= size.height;
                }

                m.style.top = y.toString() + 'px';
                m.style.left = x.toString() + 'px';
            });

            onGlobalClick(e => {
                lastClickedX = e.clientX;
                lastClickedY = e.clientY;
                post('close-menus', undefined);
            });
        `,
		setup: (panel) => {
			panel.addHandler("close-menus", (_) => {
				// close visible menus and remove them from list
				Menu.menus = Menu.menus
					.filter((m) => {
						if (m.getParent()) {
							m.getParent()?.remove(m);
							return false;
						}
						return true;
					})
					.concat(Menu.menusToAdd);
				Menu.menusToAdd = [];
			});
		},
	};
	static menus: Menu[] = [];
	static menusToAdd: Menu[] = [];

	constructor(items: MenuItemValue[], props?: MenuProps) {
		super(props);
		this.attr("class", "menu", AttrMode.add);
		this.addHandlerClass("menu");
		items.map((item) => this.add(new MenuItem(item.name, item)));
		Menu.menusToAdd.push(this);
	}
}
