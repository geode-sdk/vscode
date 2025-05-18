import { basename } from "path";
import { MarkdownString } from "vscode";
import { Placeholder, Snippet, Tabstop } from "../../utils/Snippet";
import { Project } from "../Project";
import { getAsset } from "../../config";
import { BMFontDatabase } from "./BMFontDatabase";
import { Sheet, SpriteSheetDatabase } from "./SpriteSheetDatabase";
import { readFile } from "fs/promises";
import { removeQualityDecorators } from "../../utils/resources";
import { GeodeSDK } from "../GeodeSDK";
import { Source } from "./SourceID";
import { Jimp } from "jimp";

export interface SnippetOption {
    name: string;
    snippet: Snippet;
}

export interface ResourceSaveData {
    isFavorite: boolean;
}

export abstract class Resource {

    public static readonly RESOURCE_NAME_MATCH_REGEX = /"((?<modID>[a-z0-9\-_\.]+)\/)?(?<name>\.?([\w\-\s]+\.)+(png|fnt|ogg|mp3))"(?<suffix>_spr)?/g;

    public static formPlaceholderName(name: string) {
        // Remove number parts like _001
        // Remove leading prefix like GJ_ if one exists
        // Remove all file extensions
        // Remove -hd and -uhd suffixes
        // Remove extra number parts
        const cleanName = name.replace(/^gj_?|(?:_\d+)|\d*(?:-u?hd)?\..*?$/gmi, "")
            // If a dash or underscore is found, remove it and capitalize the next character if it exists
            // If a digit is followed by a non-digit, capitalize the next character 
            .replace(/[-_](.)?|(?<=\d)([^\d])/g, (_, char1: string, char2: string) => (char1 ?? char2).toUpperCase());

        return cleanName.charAt(0).toLowerCase() + cleanName.slice(1);
    }

    protected readonly source: Source;

    protected favorite: boolean;

    constructor(source: Source) {
        this.source = source;
        this.favorite = false;
    }

    /**
     * Get an unique identifier for this resource. This ID should be composed 
     * of facts about the resource, like the file path and source, so it can be 
     * used to unambiguously resolve the resource even after a restart
     */
    public abstract getID(): string;

    /**
     * Get the display name for this resource
     */
    public abstract getDisplayName(): string;

    /**
     * Fetch the image data for this resource as base64
     * @returns Future that resolves to resource's image data as base64, or an error
     */
    public abstract fetchImage(): Promise<Buffer>;

    /**
     * Get the source of this resource
     */
    public getSource(): Source {
        return this.source;
    }

    public setFavorite(favorite: boolean) {
        this.favorite = favorite;
    }

    public isFavorite(): boolean {
        return this.favorite;
    }

    public saveUserOptions(): ResourceSaveData {
        return {
            isFavorite: this.favorite
        };
    }

    public loadUserOptions(data: ResourceSaveData) {
        this.favorite = data.isFavorite;
    }

    public async fetchImageToBase64(): Promise<string> {
        return this.fetchImage()
            .then((image) => image.toString("base64"));
    }

    public async fetchImageToMarkdown(): Promise<MarkdownString> {
        return this.fetchImageToBase64()
            .then((base64) => new MarkdownString(`![Preview of ${this.getDisplayName()}](data:image/png;base64,${base64})`));
    }

    /**
     * Get the name of this resource in code, like `"sprite-name.png"_spr`
     */
    public getUsageCode(): string {
        const fileName = this.getFileName();

        if (this.source instanceof Project) {
            // If this resource is from the currently active project, suffix with _spr
            if (this.source.isActive()) {
                return `"${fileName}"_spr`;
            } else { // Otherwise suffix with mod ID
                return `"${this.source.getModJson().id}/${fileName}"`;
            }
        } else if (this.source instanceof GeodeSDK) {
            return `"geode.loader/${fileName}"`;
        }

        // Otherwise use filename as is
        return `"${fileName}"`;
    }

    /**
     * Get a list of code actions for this resource
     */
    public getSnippetOptions?(): SnippetOption[];

    protected abstract getFileName(): string;
}

export abstract class FileResource extends Resource {

    protected path: string;

    constructor(source: Source, path: string) {
        super(source);

        this.path = path;
    }

    public override getID(): string {
        return this.path;
    }

    public override getDisplayName(): string {
        return removeQualityDecorators(basename(this.path));
    }

    public override getFileName(): string {
        return removeQualityDecorators(basename(this.path));
    }

    public getFilePath(): string {
        return this.path;
    }

    public containedInPath(path: string): boolean {
        return removeQualityDecorators(this.path) == removeQualityDecorators(path);
    }
}

export class UnknownResource extends FileResource {

    constructor(source: Source, path: string) {
        super(source, path);
    }

    public override async fetchImage(): Promise<Buffer> {
        return readFile(getAsset("unknown-{theme}.png"));
    }
}

export class SpriteResource extends FileResource {

    constructor(source: Source, path: string) {
        super(source, path);
    }

    public override async fetchImage(): Promise<Buffer> {
        return readFile(this.getFilePath());
    }

    public override getSnippetOptions(): SnippetOption[] {
        const placeholderName = Resource.formPlaceholderName(this.getDisplayName());
        const snippets: SnippetOption[] = [];
        const usage = this.getUsageCode();
        const parent = new Placeholder("this");
        const sprite = new Placeholder(`${placeholderName}Spr`);
        const button = new Placeholder(`${placeholderName}Btn`);
        const buttonSprite = new Placeholder(`${placeholderName}BtnSpr`);

        snippets.push({
            name: "Create CCSprite",
            snippet: Snippet.from`CCSprite::create(${usage})`
        });
        snippets.push({
            name: "Create CCSprite & Add Child",
            snippet: Snippet.from`
                auto ${sprite} = CCSprite::create(${usage});

                ${parent}->addChild(${sprite});
            `
        });
        sprite.reset();
        parent.reset();
        snippets.push({
            name: "Create Button & Add Child",
            snippet: Snippet.from`
                auto ${sprite} = CCSprite::create(${usage});
                auto ${button} = CCMenuItemSpriteExtra::create(${sprite}, ${parent}, menu_selector(${new Tabstop()}));

                ${parent}->addChild(${button});
            `
        });
        button.reset();
        parent.reset();
        snippets.push({
            name: "Create Button w/ ButtonSprite & Add Child",
            snippet: Snippet.from`
                auto ${buttonSprite} = ButtonSprite::create(${new Placeholder(`"Hi!"`)}, ${new Placeholder(`"bigFont.fnt"`)}, ${usage}, ${new Placeholder(".8f")});
                auto ${button} = CCMenuItemSpriteExtra::create(${buttonSprite}, ${parent}, menu_selector(${new Tabstop()}));

                ${parent}->addChild(${button});
            `
        });

        return snippets;
    }
}

export class FontResource extends FileResource {

    constructor(source: Source, path: string) {
        super(source, path);
    }

    public override async fetchImage(): Promise<Buffer> {
        return BMFontDatabase.get().loadFont(this.getFilePath()).render("Abc123");
    }

    public override getSnippetOptions(): SnippetOption[] {
        const placeholderName = Resource.formPlaceholderName(this.getDisplayName());
        const snippets: SnippetOption[] = [];
        const usage = this.getUsageCode();
        const text = new Placeholder(`"Hi!"`);
        const parent = new Placeholder("this");
        const label = new Placeholder(`${placeholderName}Label`);
        const buttonSprite = new Placeholder(`${placeholderName}BtnSpr`);
        const button = new Placeholder(`${placeholderName}Btn`);

        snippets.push({
            name: "Create Label",
            snippet: Snippet.from`CCLabelBMFont::create(${text.reset()}, ${usage})`
        });
        snippets.push({
            name: "Create Label & Add Child",
            snippet: Snippet.from`
                auto ${label} = CCLabelBMFont::create(${text.reset()}, ${usage});

                ${parent}->addChild(${label});
            `
        });
        parent.reset();
        snippets.push({
            name: "Create Button w/ ButtonSprite & Add Child",
            snippet: Snippet.from`
                auto ${buttonSprite} = ButtonSprite::create(${text.reset()}, ${usage}, ${new Placeholder('"GJ_button_01.png"')}, ${new Placeholder(".8f")});
                auto ${button} = CCMenuItemSpriteExtra::create(${buttonSprite}, ${parent}, menu_selector(${new Tabstop()}));

                ${parent}->addChild(${button});
            `
        });

        return snippets;
    }
}

export class AudioResource extends FileResource {

    constructor(source: Source, path: string) {
        super(source, path);
    }

    public override async fetchImage(): Promise<Buffer> {
        return readFile(getAsset("audio-{theme}.png"));
    }

    public override getSnippetOptions(): SnippetOption[] {
        return [
            {
                name: "Play Audio as Effect",
                snippet: Snippet.from`FMODAudioEngine::sharedEngine()->playEffect(${this.getUsageCode()})`
            }
        ];
    }
}

export class SpriteSheetResource extends FileResource {

    private readonly frames: SpriteFrameResource[];

    private coverCache?: Promise<Buffer>;

    constructor(source: Source, path: string) {
        super(source, path);

        this.frames = [];
    }

    public getFrames(): SpriteFrameResource[] {
        return this.frames;
    }

    public addFrame(frame: SpriteFrameResource) {
        this.frames.push(frame);
    }

    public override async fetchImage(): Promise<Buffer> {
        if (this.coverCache) {
            return this.coverCache;
        }

        // If this is a sheet from a mod, then it won't be an actual spritesheet 
        // but instead just a list of image files that CLI will later combine 
        // into a spritesheet
        // So we need to manually construct the image in that case
        if (this.getSource() instanceof Project) {
            this.coverCache = Sheet.createSheetCoverImage(
                this.frames.length,
                (index) => this.frames[index].fetchImage().then((image) => Jimp.read(image))
            );
        } else { // Otherwise let the spritesheet itself deal with this
            this.coverCache = SpriteSheetDatabase.get()
                .loadSheet(this.getFilePath()).then((sheet) => sheet.renderCoverImage());
        }

        return this.coverCache!;
    }
}

export class SpriteFrameResource extends Resource {

    private readonly sheet: SpriteSheetResource;

    private readonly frameOrPath: string;

    private readonly isPath: boolean;

    constructor(source: Source, sheet: SpriteSheetResource, frameOrPath: string, isPath = false) {
        super(source);

        this.sheet = sheet;
        this.frameOrPath = frameOrPath;
        this.isPath = isPath;
    }

    public override getID(): string {
        return this.getFilePath() ?? `${this.sheet.getID()}::${this.frameOrPath}`;
    }

    public override getDisplayName(): string {
        return this.isPath ? removeQualityDecorators(basename(this.frameOrPath)) : this.frameOrPath;
    }

    public override getFileName(): string {
        return this.isPath ? removeQualityDecorators(basename(this.frameOrPath)) : this.frameOrPath;
    }

    public override async fetchImage(): Promise<Buffer> {
        if (this.isPath) {
            return readFile(this.frameOrPath);
        } else {
            return SpriteSheetDatabase.get().loadSheet(this.sheet.getFilePath()).then((sheet) => sheet.extract(this.frameOrPath));
        }
    }

    public override getSnippetOptions(): SnippetOption[] {
        const placeholderName = Resource.formPlaceholderName(this.getDisplayName());
        const snippets: SnippetOption[] = [];
        const usage = this.getUsageCode();
        const parent = new Placeholder("this");
        const sprite = new Placeholder(`${placeholderName}Spr`);
        const button = new Placeholder(`${placeholderName}Btn`);

        snippets.push({
            name: "Create CCSprite",
            snippet: Snippet.from`CCSprite::createWithSpriteFrameName(${usage})`
        });
        snippets.push({
            name: "Create CCSprite & Add Child",
            snippet: Snippet.from`
                auto ${sprite} = CCSprite::createWithSpriteFrameName(${usage});

                ${parent}->addChild(${sprite});
            `
        });
        sprite.reset();
        parent.reset();
        snippets.push({
            name: "Create Button & Add Child",
            snippet: Snippet.from`
                auto ${sprite} = CCSprite::createWithSpriteFrameName(${usage});
                auto ${button} = CCMenuItemSpriteExtra::create(${sprite}, ${parent}, menu_selector(${new Tabstop()}));

                ${parent}->addChild(${button});
            `
        });

        return snippets;
    }

    public getSheet(): SpriteSheetResource {
        return this.sheet;
    }

    public getFilePath(): string | undefined {
        return this.isPath ? this.frameOrPath : undefined;
    }
}
