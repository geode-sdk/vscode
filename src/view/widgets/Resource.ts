import { env, window } from "vscode";
import { AudioResource, FileResource, Resource, SpriteFrameResource, SpriteSheetResource } from "../../project/resources/Resource";
import { Resources } from "../Package";
import { ViewProvider } from "../ViewProvider";
import { MergeProperties, Widget } from "../Widget";
import { SpriteBrowser } from "../ui/SpriteBrowser";
import { Element, Image, LoadingCircle } from "./Basic";
import { Button, IconButton } from "./Button";
import { Div } from "./Container";
import { Menu } from "./Menu";
import { Text } from "./Text";
import { AudioPlayback } from "./Interactive";
import { SourceID } from "../../project/resources/SourceID";
import { Snippet } from "../../utils/Snippet";

export class ResourceWidget extends Element {

    public static readonly RESOURCES = Resources.fromCSS(`
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

        .item > p {
            word-break: break-all;
            max-width: 100%;
            margin-top: 1rem;
            margin-bottom: 1rem;
            text-align: center;
        }

        .item > .image-div {
            min-height: 0;
            flex-grow: 1;
            align-self: center;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .item > .audio-playback {
            margin-bottom: 1rem;
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

        .item > .hover-item {
            display: none;
            align-self: flex-end;
        }

        .item:hover > .hover-item {
            display: initial;
            position: relative;
            height: 0;
        }

        .image-div > * {
            min-height: 0;
        }

        .image-div > p {
            opacity: 50%;
            font-weight: bold;
            color: var(--vscode-symbolIcon-nullForeground);
        }
    `);

    protected resource: Resource;

    protected image?: Div;

    protected favoriteButton?: IconButton;

    protected topButtons?: Div;

    protected visible?: boolean;

    protected imageData?: string;

    protected contentTimeout?: NodeJS.Timeout;

    protected imageDataClearTimeout?: NodeJS.Timeout;

    constructor(properties: MergeProperties<{ resource: Resource }>) {
        super(Widget.mergeProperties({
            tag: "article"
        }, properties));

        this.resource = properties.resource;

        this.addClass("item");
    }

    public toggleVisibility(visible: boolean) {
        if (this.visible == visible) {
            return;
        }

        // If the user scrolls really quickly, we don't want to waste time sending a massive amount of rebuilds
        this.clearTimeouts();

        if (this.visible = visible) {
            this.contentTimeout = setTimeout(() => this.content(), 20);
        } else {
            // Clear image data after a while to save memory
            this.imageDataClearTimeout = setTimeout(() => this.imageData = undefined, 5000);
            this.favoriteButton = undefined;
            this.topButtons = undefined;

            this.clear();
        }
    }

    public override dispose(): this {
        this.clearTimeouts();

        this.visible = false;
        this.imageData = undefined;
        this.favoriteButton = undefined;
        this.topButtons = undefined;

        this.clear();

        return super.dispose();
    }

    private updateFavoritesButton(): void {
        this.topButtons?.removeChild(this.favoriteButton);

        if (this.resource.isFavorite()) {
            this.favoriteButton = new IconButton({
                icon: "star-delete",
                hoverText: "Remove favorite",
                style: {
                    "color": "yellow"
                },
                onClick: (provider) => this.toggleFavorite(provider, false)
            });
        } else {
            this.favoriteButton = new IconButton({
                icon: "star-add",
                hoverText: "Add favorite",
                onClick: (provider) => this.toggleFavorite(provider, true)
            });
        }

        this.topButtons?.addChild(this.favoriteButton);
    }

    private toggleFavorite(provider: ViewProvider, state: boolean): void {
        this.resource.setFavorite(state);
        this.updateFavoritesButton();

        if (provider instanceof SpriteBrowser) {
            provider.favoritedItem(state);
        }
    }

    // a member function instead of inline arrow function to avoid ridiculous
    // indentation
    private onMoreUseOptions(): void {
        this.addChild(new Menu({
            items: this.resource.getSnippetOptions?.().map((option) => ({
                title: option.name,
                onClick: () => option.snippet.insert(SpriteBrowser.getTargetEditor())
            })) ?? []
        }));
    }

    private clearTimeouts(): void {
        if (this.contentTimeout) {
            clearTimeout(this.contentTimeout);
            this.contentTimeout = undefined;
        }

        if (this.imageDataClearTimeout) {
            clearTimeout(this.imageDataClearTimeout);
            this.imageDataClearTimeout = undefined;
        }
    }

    private content(): void {
        const bottomBtns = new Div({ className: "buttons" });

        this.addChild(
            this.topButtons = new Div({
                className: "buttons top",
                style: {
                    "align-self": "flex-end"
                }
            }).addChild(
                new IconButton({
                    icon: "info",
                    hoverText: "Show info about this item",
                    onClick: () => {
                        let path;

                        if (this.resource instanceof FileResource) {
                            path = this.resource.getFilePath();
                        } else if (this.resource instanceof SpriteFrameResource) {
                            path = this.resource.getFilePath() ?? this.resource.getSheet().getFilePath();
                        } else {
                            path = "<Unknown>";
                        }

                        window.showInformationMessage(
                            `Name: ${this.resource.getDisplayName()}\n` +
                            `Path: ${path}\n` +
                            `Type: ${this.resource.constructor.name}\n` +
                            `Source: ${SourceID.from(this.resource.getSource())}\n`
                        );
                    }
                }),
                new IconButton({
                    icon: "copy",
                    hoverText: "Copy item name",
                    onClick: async () => {
                        try {
                            await env.clipboard.writeText(this.resource.getDisplayName());

                            window.showInformationMessage("Copied name to clipboard!");
                        } catch {
                            window.showErrorMessage(
                                "Unable to copy name to clipboard!",
                            );
                        }
                    }
                })
            ),
            this.image = new Div({ className: "image-div" }).addChild(new LoadingCircle()),
            new Text({ text: this.resource.getDisplayName() })
        );

        if (this.resource instanceof AudioResource) {
            this.addChild(new AudioPlayback({ src: this.resource.getFilePath() }));
        }

        if (this.resource instanceof SpriteSheetResource) {
            bottomBtns.addChild(new Button({
                title: "View",
                startIcon: "eye",
                style: {
                    "flex": "1"
                },
                onClick: (provider) => {
                    if (provider instanceof SpriteBrowser) {
                        provider.showSheet(this.resource as SpriteSheetResource);
                    }
                }
            }));
        } else {
            bottomBtns.addChild(new Button({
                title: "Use",
                startIcon: "tools",
                style: {
                    "flex": "4"
                },
                onClick: () => Snippet.from(this.resource.getUsageCode()).insert(SpriteBrowser.getTargetEditor())
            }));

            if (this.resource.getSnippetOptions?.().length) {
                bottomBtns.addChild(new IconButton({
                    icon: "ellipsis",
                    hoverText: "More snippet options",
                    onClick: () => this.onMoreUseOptions()
                }));
            }
        }

        this.addChild(bottomBtns);
        this.updateFavoritesButton();

        if (this.imageData) {
            this.image.clear();
            this.image.addChild(new Image({ data: this.imageData }));
        } else {
            this.resource.fetchImageToBase64()
                .then((data) => {
                    if (this.image) {
                        this.image.clear();
                        this.image.addChild(new Image({ data }));
                        this.imageData = data;
                    }
                })
                .catch((error) => {
                    this.image?.clear();
                    this.image?.addChild(new Text({ text: `Unable to load image: ${error}` }))
                })
        }
    }
}