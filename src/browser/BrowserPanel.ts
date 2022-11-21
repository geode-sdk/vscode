
import { Menu, MenuItem } from "../widgets/Menu";
import { TextEditor, Uri, ViewColumn, window, workspace } from "vscode";
import { getExtConfig } from "../config";
import { Option } from "../utils/monads";
import { Element, Head, Image, Label, LoadingCircle, Spacer, Text, Badge } from "../widgets/Basic";
import { Column, Div, Grid, Row } from "../widgets/Container";
import { Button, Input, Select, Tab, TabProps, Tabs } from "../widgets/Interactive";
import { scripts } from "../widgets/Scripts";
import { Panel, ScriptPackage, Widget } from "../widgets/Widget";
import { browser } from "./browser";
import { fetchItemImage, getSnippetOptions, Item, ItemType, itemTypeID, SheetItem, sourceID, useItem } from "./item";
import { insertSnippet } from "../project/source";
import { env } from "vscode";

export class ItemWidget extends Widget {
    #item: Item<ItemType>;
    #image?: Div;
    #favoriteButton?: Button;
    #topButtons?: Div;
    #visible?: boolean;
    #contentShowTimeout?: NodeJS.Timeout;
    #imageData?: string;

    static scripts: ScriptPackage = {
        id: 'ItemWidget',
        css: /*css*/ `
            .item {
                padding: .1rem;
                display: flex;
                flex-direction: column;
                width: calc(100% - 1rem);
                height: calc(100% - 1rem);
                transition-duration: .5s;
                align-items: center;
            }

            .item > text {
                word-break: break-all;
                max-width: 100%;
                margin-top: 2px;
                margin-bottom: 2px;
            }

            .item > #image-div {
                min-height: 0;
                flex-grow: 1;
                align-self: center;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .item > .buttons {
                display: flex;
                flex-direction: row;
                align-self: stretch;
                justify-content: center;
                align-items: center;
                gap: .4rem;
            }

            .item > .buttons.top {
                flex-direction: row-reverse;
            }

            .item > .buttons {
                display: flex;
                flex-direction: row;
                align-self: stretch;
                gap: .4rem;
            }

            .item > .buttons {
                margin: 0;
            }

            .item > .hover-item {
                display: none;
                align-self: flex-end;
            }

            .item:hover > .hover-item {
                display: initial;
                position: relative;
                height: 0;
            }

            #image-div > * {
                min-height: 0;
            }
            
            #image-div > p {
                opacity: 50%;
                font-weight: bold;
                color: var(--vscode-symbolIcon-nullForeground);
            }
        `,
    };

    constructor(item: Item<ItemType>) {
        super();
        this.#item = item;
        this.attr('class', 'item');
    }

    private updateFavoritesButton() {
        this.#topButtons?.remove(this.#favoriteButton);
        if (browser.getDatabase().isFavorite(this.#item)) {
            this.#favoriteButton = new Button({
                icon: 'star-delete',
                hoverText: 'Remove favorite',
                onClick: panel => {
                    browser.getDatabase().removeFavorite(this.#item);
                    this.updateFavoritesButton();
                    if (panel instanceof BrowserPanel) {
                        panel.favoritedItem();
                    }
                }
            }).attr('style', 'color: yellow') as Button;
        } else {
            this.#favoriteButton = new Button({
                icon: 'star-add',
                hoverText: 'Add favorite',
                onClick: _ => {
                    browser.getDatabase().addFavorite(this.#item);
                    this.updateFavoritesButton();
                }
            });
        }
        this.#topButtons?.add(this.#favoriteButton);
    }

    // a member function instead of inline arrow function to avoid ridiculous 
    // indentation
    private onMoreUseOptions() {
        this.add(new Menu(
            getSnippetOptions(this.#item)
                .map(o => {
                    return {
                        name: o.name,
                        onClick: async panel => {
                            const res = await insertSnippet(
                                o.snippet,
                                BrowserPanel.getTargetEditor()
                            );
                            if (res.isError()) {
                                window.showErrorMessage(res.unwrapErr());
                            } else if (panel instanceof BrowserPanel) {
                                panel.close();
                            }
                        }
                    };
                })
        ));
    }

    private content() {
        this.add(this.#topButtons = new Div()
            .attr('class', 'buttons top')
            .attr('style', 'align-self: flex-end')
            .add(new Button({
                icon: 'info',
                hoverText: 'Show info about this item',
                onClick: _ => {
                    window.showInformationMessage(
                        `Name: ${this.#item.name}\n` + 
                        `Path: ${this.#item.path}\n` +
                        `Type: ${this.#item.type}\n` + 
                        `Source: ${this.#item.src}\n`
                    );
                }
            }))
            .add(new Button({
                icon: 'copy',
                hoverText: 'Copy item name',
                onClick: async _ => {
                    try {
                        await env.clipboard.writeText(this.#item.name);
                    } catch {
                        window.showErrorMessage('Unable to copy name to clipboard!');
                    }
                }
            }))
        );

        this.add(this.#image = new Div()
            .attr('id', 'image-div')
            .add(new LoadingCircle())
        );
        this.add(new Text(this.#item.name));

        const bottomBtns = new Div().attr('class', 'buttons');
        if (this.#item.type === ItemType.sheet) {
            bottomBtns.add(
                new Button('View', {
                    startIcon: 'eye',
                    onClick: panel => {
                        if (panel instanceof BrowserPanel) {
                            panel.showSheet(this.#item as SheetItem);
                        }
                    },
                }).attr('style', 'flex: 1')
            );
        } else {
            bottomBtns.add(new Button('Use', {
                startIcon: 'tools',
                onClick: async panel => {
                    const res = await useItem(
                        this.#item,
                        BrowserPanel.getTargetEditor()
                    );
                    if (res.isError()) {
                        window.showErrorMessage(res.unwrapErr());
                    } else if (panel instanceof BrowserPanel) {
                        panel.close();
                    }
                }
            }).attr('style', 'flex: 4'));

            if (getSnippetOptions(this.#item).length) {
                bottomBtns.add(new Button({
                    icon: 'ellipsis',
                    hoverText: 'More snippet options',
                    onClick: _ => this.onMoreUseOptions(),
                }));
            }
        }
        this.add(bottomBtns);

        this.updateFavoritesButton();

        if (this.#imageData) {
            this.#image.clear();
            this.#image.add(new Image(this.#imageData));
        } else {
            fetchItemImage(this.#item).then(data => {
                if (this.#image) {
                    this.#image.clear();
                    if (data.isValue()) {
                        this.#image.add(new Image(data.unwrap()));
                        this.#imageData = data.unwrap();
                    } else {
                        this.#image.add(new Text(data.unwrapErr()));
                    }
                }
            });
        }
    }

    becameVisible(visible: boolean) {
        if (this.#visible === visible) {
            return;
        }
        if (this.#visible = visible) {
            // if the user scrolls really quickly, we don't want to waste time 
            // sending a massive amount of rebuilds
            this.#contentShowTimeout = setTimeout(() => this.content(), 75);
        } else {
            clearTimeout(this.#contentShowTimeout);
            // clear image data after a while to save memory
            setTimeout(() => this.#imageData = undefined, 5000);
            this.#image = undefined;
            this.#favoriteButton = undefined;
            this.#topButtons = undefined;
            this.clear();
        }
    }

    build(): string {
        return /*html*/ `
            <article ${super.buildAttrs()}>
                ${super.build()}
            </article>
        `;
    }
}

export class BrowserPanel extends Panel {
    static #current?: BrowserPanel;
    // can't access real private members through base class, so making this 
    // #statsLabel would make it not work in init
    #content: Grid;
    #source: Select;
    #collection: Tabs;
    #sorting: Select;
    #quality: Select;
    #search: Input;
    #contentObserver: scripts.Observer;
    #searchTimeout?: NodeJS.Timeout;
    #showCount: number = 0;
    #loadMoreDiv?: Div;
    #currentItemList: Item<ItemType>[] = [];
    // can't save TextEditor directly as JS copies that for some reason while 
    // I need a reference
    // this current solution works though which is good. if the user has the 
    // same file open twice (for some reason), both editors will be updated 
    // simultaniously as is normal in VS Code, and some random one out of them 
    // is made active
    private static targetFile?: Uri;

    static defaultTabs: TabProps[] = [
        { id: 'all',     title: 'All', },
        { id: 'sheets',  title: 'Sheets', },
        { id: 'frames',  title: 'Frames', },
        { id: 'sprites', title: 'Sprites', },
        { id: 'fonts',   title: 'Fonts', },
        { id: 'audio',   title: 'Audio', },
    ];

    static scripts: ScriptPackage = {
        id: 'BrowserPanel',
        css: /*css*/ `
            :root {
                --item-width:   minmax(13rem, 1fr);
                --item-height:  15rem;
            }
            
            html {
                height: 100%;
            }
            
            body {
                display: flex;
                align-items: stretch;
                flex-direction: column;
                height: 100%;
            }

            main {
                display: grid;
                gap: 1rem;
                grid-template-columns: repeat(auto-fit, var(--item-width));
                grid-auto-rows: var(--item-height);
                overflow: auto;
                align-self: strech;
                align-items: center;
            }

            .load-more {
                display: flex;
                grid-column: 1 / -1;
                justify-content: center;
                align-items: center;
            }
        `
    };

    private constructor() {
        super({
            id: 'geode.sprite-browser',
            title: 'Sprite Browser',
            lightIcon: 'blockman-light.svg',
            darkIcon: 'blockman-dark.svg',
            scripts: [
                BrowserPanel.scripts,
                Head.scripts,
                Label.scripts,
                Text.scripts,
                Button.scripts,
                Row.scripts,
                Column.scripts,
                Grid.scripts,
                Div.scripts,
                Select.scripts,
                Tab.scripts,
                Tabs.scripts,
                Badge.scripts,
                ItemWidget.scripts,
                LoadingCircle.scripts,
                Image.scripts,
                Input.scripts,
                Spacer.scripts,
                Element.scripts,
                scripts.globalClickListener,
                Menu.scripts,
                MenuItem.scripts,
                scripts.observer,
            ]
        });

        this.disposables.push(window.onDidChangeActiveTextEditor(e => {
            if (e) {
                BrowserPanel.targetFile = e.document.uri;
            }
        }));

        this.add(new Column()
            .add(new Head('Sprite Browser'))
            .add(new Row()
                .add(new Column()
                    .add(new Label('Source'))
                    .add(this.#source = new Select(
                        browser.getDatabase().getCollectionOptions(),
                        { onChange: _ => this.updateData() }
                    ))
                )
                .add(new Spacer('2rem'))
                .add(this.#search = new Input({
                    placeholder: 'Search for sprites...',
                    label: 'Search',
                    focus: true,
                    startIcon: 'search',
                    onChange: _ => {
                        // don't update immediately to avoid lag
                        clearTimeout(this.#searchTimeout);
                        this.#searchTimeout = setTimeout(
                            _ => this.updateData(), 200
                        );
                    },
                }))
                .add(new Column()
                    .add(new Label('Sort'))
                    .add(this.#sorting = new Select([
                        { id: 'none', name: 'Default' },
                        { id: 'a-z',  name: 'A-Z' },
                        { id: 'z-a',  name: 'Z-A' },
                    ], {
                        onChange: _ => this.updateData()
                    }))
                )
                .add(new Spacer('2rem'))
                .add(new Column()
                    .add(new Label('Quality'))
                    .add(this.#quality = new Select([
                        { id: 'High',   name: 'High (UHD)' },
                        { id: 'Medium', name: 'Medium (HD)' },
                        { id: 'Low',    name: 'Low' },
                    ], {
                        onChange: _ => this.updateCollections(),
                        selected: getExtConfig().get<string>('textureQuality'),
                    }))
                )
            )
            .add(this.#collection = new Tabs(
                BrowserPanel.defaultTabs,
                { onChange: _ => this.updateData() }
            ))
        );
        this.add(this.#content = new Element('main'));

        this.#contentObserver = scripts.observer.createObserver(
            this, this.#content, (w, visible) => {
                if (w instanceof ItemWidget) {
                    w.becameVisible(visible);
                }
            }
        ) as scripts.Observer;

        this.updateData();
    }

    private async updateCollections() {
        await getExtConfig().update(
            'textureQuality',
            this.#quality.getSelected()
        );
        browser.getDatabase().refresh();
        this.#source.setItems(
            browser.getDatabase().getCollectionOptions()
        );
        this.updateData();
    }

    private showItems(a: number, b: number) {
        this.#content.remove(this.#loadMoreDiv);
        this.#loadMoreDiv = undefined;

        this.#currentItemList
            .slice(a, b)
            .forEach(item => this.#content.add(new ItemWidget(item)));
        
        if (b < this.#currentItemList.length) {
            const addCount = getExtConfig().get<number>('showCountIncrement') ?? 250;
            let showMoreText = '';

            if (b + addCount >= this.#currentItemList.length) {
                showMoreText = `${this.#currentItemList.length - b}`;
            } else {
                showMoreText = `${addCount}+`;
            }

            this.#loadMoreDiv = new Div()
                .attr('class', 'load-more')
                .add(new Button(`Load More (${showMoreText})`, {
                    onClick: _ => {
                        const startCount = this.#showCount;
                        this.#showCount += addCount;
                        this.showItems(startCount, this.#showCount);
                    }
                }));
            this.#content.add(this.#loadMoreDiv);
        }
    }

    private updateData() {
        this.#content.clear();

        const loadingCircle = new LoadingCircle();
        this.#content.add(loadingCircle);
        this.#content.remove(loadingCircle);

        const query = this.#search.getValue()?.toLowerCase() ?? '';

        const col = browser.getDatabase().getCollectionById(
            this.#source.getSelected() ?? 'all'
        );
        this.#currentItemList = col?.get(this.#collection.getSelected() ?? 'all')
            .filter(item => !query || item.name.toLowerCase().includes(query))
            .sort((a, b) => {
                switch (this.#sorting.getSelected()) {
                    case 'a-z':  return a.name.localeCompare(b.name);
                    case 'z-a':  return b.name.localeCompare(a.name);
                }
                return 0;
            }) ?? [];

        this.#showCount = getExtConfig().get<number>('defaultSpriteShowCount') ?? 350;
        this.showItems(0, this.#showCount);

        // todo: update count to reflect search results
        this.#collection.badge('all', col?.getTotalCount() ?? 0);
        this.#collection.badge('sheets', col?.getSheetCount() ?? 0);
        this.#collection.badge('frames', col?.getSheetSpriteCount() ?? 0);
        this.#collection.badge('sprites', col?.getSpriteCount() ?? 0);
        this.#collection.badge('fonts', col?.getFontCount() ?? 0);
        this.#collection.badge('audio', col?.getAudioCount() ?? 0);
    }

    favoritedItem() {
        // update UI if favorite state changed while in favorites tab, otherwise 
        // no need
        if (this.#source.getSelected() === 'favorites') {
            this.updateData();
        }
    }

    showSheet(item: SheetItem) {
        this.#collection.setTabs([
            ...BrowserPanel.defaultTabs,
            {
                id: item.name,
                title: item.name,
                badge: item.items.length,
                closable: true,
            }
        ]);
        this.#collection.select(item.name);
        this.updateData();
    }

    static getTargetEditor(): Option<TextEditor> {
        return window.visibleTextEditors.find(
            f => f.document.uri.fsPath === BrowserPanel.targetFile?.fsPath
        );
    }

    protected onDispose(): void {
        BrowserPanel.#current = undefined;
    }

    static show() {
        if (!BrowserPanel.#current) {
            BrowserPanel.targetFile = window.activeTextEditor?.document.uri;
            BrowserPanel.#current = new BrowserPanel();
        }
        BrowserPanel.#current.show(ViewColumn.Beside);
    }
}
