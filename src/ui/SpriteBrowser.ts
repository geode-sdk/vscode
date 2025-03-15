import { Menu, MenuItem } from "../widgets/Menu";
import { SnippetString, TextEditor, Uri, ViewColumn, window, workspace } from "vscode";
import { getExtConfig } from "../config";
import { Future, None, Option } from "../utils/monads";
import {
	Element,
	Head,
	Image,
	Label,
	LoadingCircle,
	Spacer,
	Text,
	Badge,
} from "../widgets/Basic";
import { Column, Div, Grid, Row } from "../widgets/Container";
import {
	AudioPlayback,
	Button,
	Input,
	Select,
	Tab,
	TabProps,
	Tabs,
} from "../widgets/Interactive";
import { scripts } from "../widgets/Scripts";
import { Panel, ScriptPackage, Widget } from "../widgets/Widget";
import { insertSnippet } from "../utils/snippet";
import { env } from "vscode";
import Fuse from "fuse.js";
import { ResourceDatabase, ResourceType } from "../project/resources/ResourceDatabase";
import { AudioResource, FileResource, FontResource, Resource, SourceID, sourceID, SpriteFrameResource, SpriteResource, SpriteSheetResource } from "../project/resources/Resource";

export class ResourceWidget extends Widget {
	#resource: Resource;
	#image?: Div;
	#favoriteButton?: Button;
	#topButtons?: Div;
	#visible?: boolean;
	#contentShowTimeout?: NodeJS.Timeout;
	#imageData?: string;

	static scripts: ScriptPackage = {
		id: "ResourceWidget",
		css: /*css*/ `
            .item {
				margin: 0px;
                padding: .5rem;
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

	constructor(resource: Resource) {
		super();
		this.#resource = resource;
		this.attr("class", "item");
	}

	private updateFavoritesButton() {
		this.#topButtons?.remove(this.#favoriteButton);
		if (this.#resource.isFavorite()) {
			this.#favoriteButton = new Button({
				icon: "star-delete",
				hoverText: "Remove favorite",
				onClick: (panel) => {
					this.#resource.setFavorite(false);
					this.updateFavoritesButton();
					if (panel instanceof SpriteBrowserPanel) {
						panel.favoritedItem();
					}
				},
			}).attr("style", "color: yellow") as Button;
		}
		else {
			this.#favoriteButton = new Button({
				icon: "star-add",
				hoverText: "Add favorite",
				onClick: (_) => {
					this.#resource.setFavorite(true);
					this.updateFavoritesButton();
				},
			});
		}
		this.#topButtons?.add(this.#favoriteButton);
	}

	// a member function instead of inline arrow function to avoid ridiculous
	// indentation
	private onMoreUseOptions() {
		this.add(
			new Menu(
				this.#resource.getSnippetOptions().map((o) => {
					return {
						name: o.name,
						onClick: async (panel) => {
							const res = await insertSnippet(
								o.snippet,
								SpriteBrowserPanel.getTargetEditor(),
							);
							if (res.isError()) {
								window.showErrorMessage(res.unwrapErr());
							}
							else if (panel instanceof SpriteBrowserPanel) {
								panel.close();
							}
						},
					};
				}),
			),
		);
	}

	private content() {
		this.add(
			(this.#topButtons = new Div()
				.attr("class", "buttons top")
				.attr("style", "align-self: flex-end")
				.add(
					new Button({
						icon: "info",
						hoverText: "Show info about this item",
						onClick: (_) => {
							let path;
							if (this.#resource instanceof FileResource) {
								path = this.#resource.getFilePath();
							}
							else if (this.#resource instanceof SpriteFrameResource) {
								path = this.#resource.getFilePath() ?? this.#resource.getSheet().getFilePath();
							}
							else {
								path = "<Unknown>";
							}
							window.showInformationMessage(
								`Name: ${this.#resource.getDisplayName()}\n` +
									`Path: ${path}\n` +
									`Type: ${this.#resource.constructor.name}\n` +
									`Source: ${sourceID(this.#resource.getSource())}\n`,
							);
						},
					}),
				)
				.add(
					new Button({
						icon: "copy",
						hoverText: "Copy item name",
						onClick: async (_) => {
							try {
								await env.clipboard.writeText(this.#resource.getDisplayName());
							} catch {
								window.showErrorMessage(
									"Unable to copy name to clipboard!",
								);
							}
						},
					}),
				)),
		);

		this.add(
			(this.#image = new Div()
				.attr("id", "image-div")
				.add(new LoadingCircle())),
		);
		this.add(new Text(this.#resource.getDisplayName()));

		if (this.#resource instanceof AudioResource) {
			this.add(new AudioPlayback({ srcFile: this.#resource.getFilePath() }));
		}

		const bottomBtns = new Div().attr("class", "buttons");
		if (this.#resource instanceof SpriteSheetResource) {
			bottomBtns.add(
				new Button("View", {
					startIcon: "eye",
					onClick: (panel) => {
						if (panel instanceof SpriteBrowserPanel) {
							panel.showSheet(this.#resource as SpriteSheetResource);
						}
					},
				}).attr("style", "flex: 1"),
			);
		}
		else {
			bottomBtns.add(
				new Button("Use", {
					startIcon: "tools",
					onClick: async (panel) => {
						try {
							const res = await insertSnippet(
								new SnippetString(this.#resource.getUsageCode()),
								SpriteBrowserPanel.getTargetEditor()
							);
							if (res.isError()) {
								throw res.unwrapErr();
							}
							panel.close();
						}
						catch (e: any) {
							window.showErrorMessage(e.toString());
						}
					},
				}).attr("style", "flex: 4"),
			);

			if (this.#resource.getSnippetOptions().length) {
				bottomBtns.add(
					new Button({
						icon: "ellipsis",
						hoverText: "More snippet options",
						onClick: (_) => this.onMoreUseOptions(),
					}),
				);
			}
		}
		this.add(bottomBtns);

		this.updateFavoritesButton();

		if (this.#imageData) {
			this.#image.clear();
			this.#image.add(new Image(this.#imageData));
		}
		else {
			this.#resource.fetchImage().then((data) => {
				if (this.#image) {
					this.#image.clear();
					if (data.isValue()) {
						const imgData = data.unwrap().toString("base64");
						this.#image.add(new Image(imgData));
						this.#imageData = imgData;
					}
					else {
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
		if ((this.#visible = visible)) {
			// if the user scrolls really quickly, we don't want to waste time
			// sending a massive amount of rebuilds
			this.#contentShowTimeout = setTimeout(() => this.content(), 75);
		}
		else {
			clearTimeout(this.#contentShowTimeout);
			// clear image data after a while to save memory
			setTimeout(() => (this.#imageData = undefined), 5000);
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

export class SpriteBrowserPanel extends Panel {
	static #current?: SpriteBrowserPanel;
	#content: Grid;
	#source: Select;
	#collection: Tabs;
	#sorting: Select;
	#quality: Select;
	#search: Input;
	#searchResults: Text;
	#contentObserver: scripts.Observer;
	#searchTimeout?: NodeJS.Timeout;
	#showCount: number = 0;
	#loadMoreDiv?: Div;
	#currentItemList: Resource[] = [];
	// can't save TextEditor directly as JS copies that for some reason while
	// I need a reference
	// this current solution works though which is good. if the user has the
	// same file open twice (for some reason), both editors will be updated
	// simultaniously as is normal in VS Code, and some random one out of them
	// is made active
	private static targetFile?: Uri;

	static defaultTabs: TabProps[] = [
		{ id: "all", title: "All" },
		{ id: "favorites", title: "Favorites" },
		{ id: "spritesheets", title: "Sheets" },
		{ id: "frames", title: "Frames" },
		{ id: "sprites", title: "Sprites" },
		{ id: "fonts", title: "Fonts" },
		{ id: "audio", title: "Audio" },
		{ id: "unknown", title: "Unknown" },
	] satisfies { id: ResourceType, title: string }[];

	static scripts: ScriptPackage = {
		id: "SpriteBrowserPanel",
		css: /*css*/ `
            :root {
                --item-width:   minmax(11rem, 1fr);
                --item-height:  13rem;
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
				gap: 0rem;
                grid-template-columns: repeat(auto-fit, var(--item-width));
                grid-auto-rows: var(--item-height);
                overflow: auto;
                align-self: stretch;
                align-items: center;
            }

            .load-more {
                display: flex;
                grid-column: 1 / -1;
                justify-content: center;
                align-items: center;
            }
        `,
	};

	private static getCollectionOptions(): { id: string, name: string }[] {
		return ResourceDatabase.get().getCollections().map(c => {
			return {
				id: c.getID(),
				name: c.getDisplayName()
			};
		});
	}

	private constructor() {
		super({
			id: "geode.sprite-browser",
			title: "Sprite Browser",
			lightIcon: "blockman-light.svg",
			darkIcon: "blockman-dark.svg",
			scripts: [
				SpriteBrowserPanel.scripts,
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
				ResourceWidget.scripts,
				LoadingCircle.scripts,
				Image.scripts,
				Input.scripts,
				Spacer.scripts,
				Element.scripts,
				scripts.globalClickListener,
				Menu.scripts,
				MenuItem.scripts,
				AudioPlayback.scripts,
				scripts.observer,
			],
		});

		this.disposables.push(
			window.onDidChangeActiveTextEditor((e) => {
				if (e) {
					SpriteBrowserPanel.targetFile = e.document.uri;
				}
			}),
		);

		this.add(
			new Column()
				.add(new Head("Sprite Browser"))
				.add(
					new Row()
						.add(
							new Column()
								.add(new Label("Source"))
								.add(
									(this.#source = new Select(
										SpriteBrowserPanel.getCollectionOptions(),
										{ onChange: (_) => this.updateData() },
									)),
								),
						)
						.add(new Spacer("2rem"))
						.add(
							(this.#search = new Input({
								placeholder: "Search for resources...",
								label: "Search",
								focus: true,
								startIcon: "search",
								onChange: (_) => {
									// don't update immediately to avoid lag
									clearTimeout(this.#searchTimeout);
									this.#searchTimeout = setTimeout(
										(_) => this.updateData(),
										200,
									);
								},
							})),
						)
						.add(
							new Column().add(new Label("Sort")).add(
								(this.#sorting = new Select(
									[
										{ id: "none", name: "Default" },
										{ id: "a-z", name: "A-Z" },
										{ id: "z-a", name: "Z-A" },
									],
									{
										onChange: (_) => this.updateData(),
									},
								)),
							),
						)
						.add(new Spacer("2rem"))
						.add(
							new Column().add(new Label("Quality")).add(
								(this.#quality = new Select(
									[
										{ id: "High", name: "High (UHD)" },
										{ id: "Medium", name: "Medium (HD)" },
										{ id: "Low", name: "Low" },
									],
									{
										onChange: (_) =>
											this.updateCollections(),
										selected:
											getExtConfig().get<string>(
												"textureQuality",
											),
									},
								)),
							),
						),
				)
				.add(
					(this.#collection = new Tabs(SpriteBrowserPanel.defaultTabs, {
						onChange: (_) => this.updateData(),
					})),
				),
		);
		this.add((this.#content = new Element("main")));
		this.add((this.#searchResults = new Text("Loading...")));

		this.#contentObserver = scripts.observer.createObserver(
			this,
			this.#content,
			(w, visible) => {
				if (w instanceof ResourceWidget) {
					w.becameVisible(visible);
				}
			},
		) as scripts.Observer;

		this.updateData();
	}

	private async updateCollections() {
		await getExtConfig().update("textureQuality", this.#quality.getSelected());
		await ResourceDatabase.get().reloadAll();
		this.#source.setItems(SpriteBrowserPanel.getCollectionOptions());
		this.updateData();
	}

	private showItems(a: number, b: number) {
		this.#content.remove(this.#loadMoreDiv);
		this.#loadMoreDiv = undefined;

		this.#currentItemList
			.slice(a, b)
			.forEach(resource => this.#content.add(new ResourceWidget(resource)));

		if (b < this.#currentItemList.length) {
			const addCount =
				getExtConfig().get<number>("showCountIncrement") ?? 250;
			let showMoreText = "";

			if (b + addCount >= this.#currentItemList.length) {
				showMoreText = `${this.#currentItemList.length - b}`;
			} else {
				showMoreText = `${addCount}+`;
			}

			this.#loadMoreDiv = new Div().attr("class", "load-more").add(
				new Button(`Load More (${showMoreText})`, {
					onClick: (_) => {
						const startCount = this.#showCount;
						this.#showCount += addCount;
						this.showItems(startCount, this.#showCount);
					},
				}),
			);
			this.#content.add(this.#loadMoreDiv);
		}
	}

	private updateData() {
		this.#content.clear();

		const loadingCircle = new LoadingCircle();
		this.#content.add(loadingCircle);
		this.#content.remove(loadingCircle);

		const query = this.#search.getValue()?.toLowerCase() ?? "";

		this.#showCount = getExtConfig().get<number>("defaultSpriteShowCount") ?? 350;

		const collection = ResourceDatabase.get().getCollection(this.#source.getSelected() ?? "all");
		if (!collection) {
			return;
		}
		const selectedTab = this.#collection.getSelected();
		console.error(selectedTab);
		const resources = selectedTab?.startsWith("sheet:") ?
			collection.getFramesInSpriteSheet(selectedTab.substring(6)) :
			collection.getResources(selectedTab as ResourceType);
		if (query.length) {
			const fuse = new Fuse(resources, {
				keys: [{ 
					name: "name",
					getFn: r => r.getDisplayName(),
				}],
				threshold: 0.2,
			});
			this.#currentItemList = fuse.search(query).map(t => t.item);

			const itemCount = this.#currentItemList.length;
			this.#searchResults?.setText(`Found ${itemCount} result${itemCount !== 1 ? "s" : ""}`);
		}
		else {
			this.#currentItemList = resources.sort((a, b) => {
				switch (this.#sorting.getSelected()) {
					case "a-z":
						return a.getDisplayName().localeCompare(b.getDisplayName());
					case "z-a":
						return b.getDisplayName().localeCompare(a.getDisplayName());
				}
				return 0;
			});

			const itemCount = Math.min(this.#showCount, resources.length);
			this.#searchResults?.setText(`Showing ${itemCount} item${itemCount !== 1 ? "s" : ""}`);
		}

		this.showItems(0, this.#showCount);

		for (const [key, value] of Object.entries(collection.getStats())) {
			this.#collection.badge(key, value.count);
		}
	}

	favoritedItem() {
		// update UI if favorite state changed while in favorites tab, otherwise
		// no need
		if (this.#source.getSelected() === "favorites") {
			this.updateData();
		}
	}

	showSheet(item: SpriteSheetResource) {
		this.#collection.setTabs([
			...SpriteBrowserPanel.defaultTabs,
			{
				id: `sheet:${item.getID()}`,
				title: item.getDisplayName(),
				badge: item.getFrames().length,
				closable: true,
			},
		]);
		this.#collection.select(`sheet:${item.getID()}`);
		this.updateData();
	}

	static getTargetEditor(): Option<TextEditor> {
		return window.visibleTextEditors.find(
			(f) => f.document.uri.fsPath === SpriteBrowserPanel.targetFile?.fsPath,
		);
	}

	protected onDispose(): void {
		SpriteBrowserPanel.#current = undefined;
	}

	static show() {
		if (!SpriteBrowserPanel.#current) {
			SpriteBrowserPanel.targetFile = window.activeTextEditor?.document.uri;
			SpriteBrowserPanel.#current = new SpriteBrowserPanel();
		}
		SpriteBrowserPanel.#current.show(ViewColumn.Beside);
	}
}
