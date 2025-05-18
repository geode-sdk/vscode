import { Option } from "../../utils/monads";
import { Resources } from "../Package";
import { GetWidgetProperties, MergeProperties, Widget } from "../Widget";
import { Badge, Element } from "./Basic";
import { IconButton } from "./Button";
import { EventHandler, EventWidget } from "./Interactive";
import { CustomTextElement } from "./Text";

export class Tab extends CustomTextElement {

    public static readonly RESOURCES = Resources.fromResources({
        // For some reason MS fast just can't figure out how to move that damn underline so I'll just unMS it
        css: `
            vscode-panel-tab[aria-selected="true"] {
                border-bottom: 1px solid var(--panel-tab-active-foreground);
            }
        `,
        js: `onMessage("delete-panel-view", ({ id }) => document.getElementById(id).remove());`
    });

    protected badge?: Badge;

    protected closeButton?: IconButton;

    protected readonly content?: Widget;

    constructor(properties: MergeProperties<{
        id: string,
        text: string,
        count?: number,
        closable?: boolean,
        content?: Widget
    }>) {
        super(Widget.mergeProperties({
            tag: "vscode-panel-tab"
        }, properties));

        if (properties.content) {
            this.content = properties.content;
        }

        if (properties.count) {
            this.setBadge(properties.count);
        }

        if (properties.closable) {
            this.addCloseButton();
        }
    }

    public getBadge(): Option<Badge> {
        return this.badge;
    }

    public setBadge(count: number): this {
        if (this.badge) {
            this.badge.setCount(count);
        } else {
            this.addChild(this.badge = new Badge({ count }));

            this.badge.setAttribute("appearance", "secondary");

            if (this.closeButton) {
                // Bump it to the back
                this.replaceChild(this.closeButton, this.closeButton);
            }
        }

        return this;
    }

    public removeBadge(): this {
        this.removeChild(this.badge);
        this.badge = undefined;

        return this;
    }

    public getCloseButton(): Option<IconButton> {
        return this.closeButton;
    }

    public addCloseButton(): this {
        return this.addChild(this.closeButton = new IconButton({ icon: "close", onClick: () => {
            const parent = this.getParent();

            parent?.removeChild(this);

            if (parent instanceof Tabs) {
                parent.setSelected(parent.getSelected());
            }
        } }));
    }

    public removeCloseButton(): this {
        this.removeChild(this.closeButton);
        this.closeButton = undefined;

        return this;
    }

    public getContent(): Option<Widget> {
        return this.content;
    }

    public override dispose(): this {
        this.post("delete-panel-view", { id: this.getWidgetID() });

        return super.dispose();
    }
}

class TabPanel extends Element {

    constructor(tab: Tab) {
        super(Widget.mergeProperties({
            tag: "vscode-panel-view"
        }, { id: tab.getWidgetID() }));
    }
}

export class Tabs extends EventWidget {

    private static readonly EVENT_NAME = "tabs";

    public static readonly RESOURCES = EventWidget.constructResources(Tabs.EVENT_NAME, "change", "event.srcElement._activeid");

    protected history: string[];

    protected onChange?: EventHandler;

    constructor(properties: MergeProperties<{
        tabs: GetWidgetProperties<typeof Tab>[],
        selected?: string,
        onChange?: EventHandler
    }>) {
        super(Widget.mergeProperties({
            eventName: Tabs.EVENT_NAME,
            onEvent: (_, args) => this.setSelected(args.value)
        }, properties));

        this.history = [];
        this.onChange = properties.onChange;

        this.setAttribute("activeindicator", false);
        this.setTabs(properties.tabs, properties.selected);
    }

    public getTabs(): Tab[] {
        return this.getChildren().filter((tab) => tab instanceof Tab) as Tab[];
    }

    public getTab(tabID: string): Option<Tab> {
        return this.getChildren().find((tab) => tab instanceof Tab && tab.getID() == tabID) as Option<Tab>;
    }

    public setTabs(tabs: GetWidgetProperties<typeof Tab>[], selected?: string): this {
        this.clear();
        tabs.forEach((tab) => this.addChild(new Tab(tab)));

        return this.setSelected(selected);
    }

    public override addChild(...children: Widget[]): this {
        return super.addChild(...children.reduce<Widget[]>((acc, child) => {
            acc.push(child);

            if (child instanceof Tab) {
                acc.push(new TabPanel(child));
            }

            return acc;
        }, []));
    }

    public getSelected(): Option<string> {
        return this.getAttribute("activeid");
    }

    public setSelected(id?: string): this {
        const tabs = this.getChildren().filter((tab) => tab instanceof Tab) as Tab[];
        const provider = this.getProvider();

        if (!tabs.length) {
            return this;
        } else if (!id || tabs.every((tab) => tab.getID() != id)) {
            id = undefined;

            while (this.history.length) {
                const back = this.history.at(-1)!;

                if (tabs.some((tab) => tab.getID() == back)) {
                    id = back;

                    break;
                } else {
                    this.history.pop();
                }
            }

            if (!id) {
                this.history.push(id = tabs[0].getID()!);
            }
        } else {
            this.history.push(id);            
        }

        this.setAttribute("activeid", id);
        tabs.forEach((tab) => {
            const isSelected = tab.getID() == id;

            // MS Fast sometimes just randomly forgets it should be actively watching... No clue why but a reminder seems to work
            tab.setAttribute("aria-selected", isSelected).setAttribute("tabindex", isSelected ? 0 : -1);
        });

        if (provider) {
            this.onChange?.(provider, { value: id });
        }

        return this;
    }

    public getText(tabID: string): Option<string> {
        return this.getTab(tabID)?.getText();
    }

    public getBadgeCount(tabID: string): Option<number> {
        return this.getTab(tabID)?.getBadge()?.getCount();
    }

    public setBadgeCount(tabID: string, newCount: number): this {
        this.getTab(tabID)?.setBadge(newCount);

        return this;
    }

    public removeBadge(tabID: string): this {
        this.getTab(tabID)?.removeBadge();

        return this;
    }

    public getCloseButton(tabID: string): Option<IconButton> {
        return this.getTab(tabID)?.getCloseButton();
    }

    public addCloseButton(tabID: string): this {
        this.getTab(tabID)?.addCloseButton();

        return this;
    }

    public removeCloseButton(tabID: string): this {
        this.getTab(tabID)?.removeCloseButton();

        return this;
    }

    public getContent(tabID: string): Option<Widget> {
        return this.getTab(tabID)?.getContent();
    }

    public override build(): string {
        return /*html*/ `
            <vscode-panels ${this.getFormattedAttributes()}>
                ${this.buildChildren()}
            </vscode-panels>
        `;
    }
}