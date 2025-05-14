import { TextEditor, Uri, window } from "vscode";
import { getExtConfig } from "../../config";
import { Resource, SpriteSheetResource } from "../../project/resources/Resource";
import { ResourceDatabase, ResourceType } from "../../project/resources/ResourceDatabase";
import { ViewProvider } from "../ViewProvider";
import { GetWidgetProperties } from "../Widget";
import { Column, Div, Row } from "../widgets/Container";
import { Input, Select, SelectItem } from "../widgets/Interactive";
import { Tab, Tabs } from "../widgets/Tab";
import { Label, Text } from "../widgets/Text";
import { SizeUnit } from "../widgets/types/Size";
import { Element, LoadingCircle } from "../widgets/Basic";
import Fuse from "fuse.js";
import { Button } from "../widgets/Button";
import { Option } from "../../utils/monads";
import { Resources } from "../Package";
import { ResourceWidget } from "../widgets/Resource";

export class SpriteBrowser extends ViewProvider {

    public static readonly RESOURCES = Resources.fromCSS(`
        main {
            display: grid;
            gap: .2rem;
            grid-template-columns: repeat(auto-fit, var(--item-width));
            grid-auto-rows: var(--item-height);
            overflow-y: auto;
            overflow-x: hidden;
            align-self: stretch;
            align-items: center;
        }

        .load-more {
            display: flex;
            grid-column: 1 / -1;
            justify-content: center;
            align-items: center;
        }
    `);

    private static readonly DEFAULT_TABS: GetWidgetProperties<typeof Tab>[] = [
        { id: "all", text: "All" },
        { id: "favorites", text: "Favorites" },
        { id: "spritesheets", text: "Sheets" },
        { id: "frames", text: "Frames" },
        { id: "sprites", text: "Sprites" },
        { id: "fonts", text: "Fonts" },
        { id: "audio", text: "Audio" },
        { id: "unknown", text: "Unknown" },
    ] satisfies { id: ResourceType, text: string }[];

    protected readonly content: Element;

    protected readonly collection: Tabs;

    protected readonly source: Select;

    protected readonly search: Input;

    protected readonly sorting: Select;

    protected readonly quality: Select;

    protected searchResults: Text;

    protected searchTimeout?: NodeJS.Timeout;

    protected loadMoreDiv?: Div;

    protected showCount: number;

    protected currentItemList: Resource[];

    // Can't save TextEditor directly as JS copies that for some reason while
    // I need a reference
    // This current solution works though which is good. If the user has the
    // same file open twice (for some reason), both editors will be updated
    // simultaniously as is normal in VS Code, and some random one out of them
    // is made active
    private static targetFile?: Uri;

    public static getTargetEditor(): Option<TextEditor> {
        return window.visibleTextEditors.find((editor) => editor.document.uri.fsPath === SpriteBrowser.targetFile?.fsPath);
    }

    private static getCollectionOptions(): SelectItem[] {
        return ResourceDatabase.get().getCollections().map((collection) => ({
            id: collection.getID(),
            name: collection.getDisplayName()
        }));
    }

    constructor() {
        super();

        this.showCount = 0;
        this.currentItemList = [];

        this.addChild(
            new Column().addChild(
                new Row({
                    spacing: {
                        amount: 2,
                        unit: SizeUnit.REM
                    }
                }).addChild(
                    new Column().addChild(
                        new Label({ text: "Source" }),
                        this.source = new Select({
                            items: SpriteBrowser.getCollectionOptions(),
                            onChange: () => this.updateData()
                        })
                    ),
                    this.search = new Input({
                        label: "Search",
                        placeholder: "Search for resources...",
                        startIcon: "search",
                        focus: true,
                        onChange: () => {
                            // Don't update immediately to avoid lag
                            clearTimeout(this.searchTimeout);

                            this.searchTimeout = setTimeout(() => this.updateData(), 200);
                        }
                    }),
                    new Column().addChild(
                        new Label({ text: "Sort" }),
                        this.sorting = new Select({
                            items: [
                                { id: "none", name: "Default" },
                                { id: "a-z", name: "A-Z" },
                                { id: "z-a", name: "Z-A" }
                            ],
                            onChange: () => this.updateData()
                        })
                    ),
                    new Column().addChild(
                        new Label({ text: "Quality" }),
                        this.quality = new Select({
                            items: [
                                { id: "High", name: "High (UHD)" },
                                { id: "Medium", name: "Medium (HD)" },
                                { id: "Low", name: "Low" }
                            ],
                            onChange: () => this.updateCollections(),
                            selected: getExtConfig().get<string>("textureQuality")
                        })
                    )
                ),
                this.collection = new Tabs({
                    tabs: SpriteBrowser.DEFAULT_TABS,
                    onChange: () => this.updateData()
                }),
            ),
            this.content = new Element({ tag: "main" }),
            this.searchResults = new Text({ text: "Loading..." })
        );
        this.updateData();
    }

    public favoritedItem(state: boolean) {
        this.collection.setBadgeCount("favorites", this.collection.getBadgeCount("favorites")! + (state ? 1 : -1));

        if (this.collection.getSelected() == "favorites") {
            this.updateData();
        }
    }

    public showSheet(item: SpriteSheetResource) {
        const id = `sheet:${item.getID()}`;

        this.collection.addChild(new Tab({
            id,
            text: item.getDisplayName(),
            count: item.getFrames().length,
            closable: true,
        }));
        this.collection.setSelected(id);
        this.updateData();
    }

    protected override preInit(): void {
        this.registerDisposable(window.onDidChangeActiveTextEditor((editor) => SpriteBrowser.targetFile = editor?.document.uri));
        this.content.registerObserver((widget, visible) => {
            if (widget instanceof ResourceWidget) {
                widget.toggleVisibility(visible);
            }
        });
    }

    private async updateCollections() {
        await getExtConfig().update("textureQuality", this.quality.getSelected());
        await ResourceDatabase.get().reloadAll();

        this.source.setItems(SpriteBrowser.getCollectionOptions());
        this.updateData();
    }

    private updateData() {
        this.content.clear();
        this.content.addChild(new LoadingCircle());
        this.showCount = getExtConfig().get<number>("defaultSpriteShowCount") ?? 350;

        const query = this.search.getValue()?.toLowerCase() ?? "";
        const collection = ResourceDatabase.get().getCollection(this.source.getSelected() ?? "all");

        if (!collection) {
            return;
        }

        const selectedTab = this.collection.getSelected();
        const resources = selectedTab?.startsWith("sheet:") ?
            collection.getFramesInSpriteSheet(selectedTab.substring(6)) :
            collection.getResources(selectedTab as ResourceType);

        if (query.length) {
            this.currentItemList = new Fuse(resources, {
                keys: [{
                    name: "name",
                    getFn: (resource) => resource.getDisplayName(),
                }],
                threshold: 0.2,
            }).search(query).map((result) => result.item);

            this.searchResults?.setText(`Found ${this.currentItemList.length} result${this.currentItemList.length != 1 ? "s" : ""}`);
        } else {
            const itemCount = Math.min(this.showCount, resources.length);
            this.currentItemList = resources.sort((a, b) => {
                switch (this.sorting.getSelected()) {
                    case "a-z":
                        return a.getDisplayName().localeCompare(b.getDisplayName());
                    case "z-a":
                        return b.getDisplayName().localeCompare(a.getDisplayName());
                }
                return 0;
            });

            this.searchResults?.setText(`Showing ${itemCount} item${itemCount != 1 ? "s" : ""}`);
        }

        this.content.clear();
        this.showItems(0, this.showCount);
        Object.entries(collection.getStats()).forEach(([key, value]) => this.collection.setBadgeCount(key, value.count));
    }

    private showItems(from: number, to: number) {
        this.content.removeChild(this.loadMoreDiv);
        this.loadMoreDiv = undefined;

        this.currentItemList.slice(from, to).forEach((resource) => this.content.addChild(new ResourceWidget({ resource })));

        if (to < this.currentItemList.length) {
            const addCount = getExtConfig().get<number>("showCountIncrement") ?? 250;
            let showMoreText;

            if (to + addCount >= this.currentItemList.length) {
                showMoreText = `${this.currentItemList.length - to}+`;
            } else {
                showMoreText = `${addCount}+`;
            }

            this.content.addChild(this.loadMoreDiv = new Div({
                className: "load-more"
            }).addChild(new Button({
                title: `Load More (${showMoreText})`,
                onClick: () => {
                    const startCount = this.showCount;

                    this.showItems(startCount, this.showCount += addCount);
                }
            })));
        }
    }
}
