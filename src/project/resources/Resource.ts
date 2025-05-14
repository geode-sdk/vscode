import { Err, Future, None, Ok, Option } from "../../utils/monads";
import { basename } from "path";
import { MarkdownString, SnippetString } from "vscode";
import { Placeholder, snippet } from "../../utils/snippet";
import camelCase from "camelcase";
import { Profile } from "../GeodeCLI";
import { Project } from "../Project";
import { getAsset } from "../../config";
import { BMFontDatabase } from "./BMFontDatabase";
import { createCoverImage, SpriteSheetDatabase } from "./SpriteSheetDatabase";
import sharp = require("sharp");
import { readFile } from "fs/promises";
import { removeQualityDecorators } from "../../utils/resources";
import { GeodeSDK } from "../GeodeSDK";

function formPlaceholderName(name: string) {
	return camelCase(
		name
			// remove number part like _001
			// remove leading prefix like GJ_ if one exists
			// remove all file extensions & -hd and -uhd suffixes
			// remove extra GJ or number parts
			.replace(
				/(^[a-zA-Z0-9]{0,3}_)|(_[0-9]+)|((-hd|-uhd)?\.[a-z]+)|(GJ|[0-9]+)/g,
				"",
			),
	);
}

export type Source = Profile | Project;

/**
 * Wrapper for a string ID to a `Source` so you don't accidentally pass just 
 * any arbitary string to a function expecting a `SourceID`
 */
export class SourceID {
	#id: string;
	constructor(id: string) {
		this.#id = id;
	}
	public toString() {
		return this.#id;
	}
}

export function sourceIDForModID(id: string): SourceID {
	return new SourceID(`mod:${id}`);
}
export function sourceIDForProfileName(name: string): SourceID {
	return new SourceID(`gd:${name}`);
}
export function sourceIDForDir(path: string): SourceID {
	return new SourceID(`dir:${path}`);
}
export function sourceID(src: Source): SourceID {
	if (typeof src === "string") {
		return sourceIDForDir(src);
	}
	else if (src instanceof Project) {
		return sourceIDForModID(src.getModJson().id);
	}
	else if (src instanceof Profile) {
		return sourceIDForProfileName(src.getName());
	}
	else {
		// exhaustiveness check
		return src satisfies never;
	}
}

export interface SnippetOption {
	name: string;
	snippet: SnippetString;
}

export type ResourceSaveData = {
	isFavorite: boolean,
};
export function isResourceSaveData(obj: any): obj is ResourceSaveData {
	return "isFavorite" in obj;
}

export const RESOURCE_NAME_MATCH_REGEX = /"((?<modID>[a-z0-9\-_\.]+)\/)?(?<name>\.?([\w\-\s]+\.)+(png|fnt|ogg|mp3))"(?<suffix>_spr)?/g;

export abstract class Resource {
	#source: Source;
	#favorite: boolean = false;

	constructor(source: Source) {
		this.#source = source;
	}

	/**
	 * Get the source of this resource
	 */
	getSource(): Source {
		return this.#source;
	}

	setFavorite(favorite: boolean) {
		this.#favorite = favorite;
	}
	isFavorite(): boolean {
		return this.#favorite;
	}

	saveUserOptions(): ResourceSaveData {
		return {
			isFavorite: this.#favorite,
		};
	}
	loadUserOptions(data: ResourceSaveData) {
		this.#favorite = data.isFavorite;
	}

	/**
	 * Get an unique identifier for this resource. This ID should be composed 
	 * of facts about the resource, like the file path and source, so it can be 
	 * used to unambiguously resolve the resource even after a restart
	 */
	abstract getID(): string;

	/**
	 * Get the display name for this resource
	 */
	abstract getDisplayName(): string;

	/**
	 * Fetch the image data for this resource as base64
	 * @returns Future that resolves to resource's image data as base64, or an error
	 */
	abstract fetchImage(): Future<Buffer>;

	async fetchImageToBase64(): Future<string> {
		const buffer = await this.fetchImage();
		if (buffer.isError()) {
			return Err(buffer.unwrapErr());
		}
		return Ok(buffer.unwrap().toString("base64"));
	}
	async fetchImageToMarkdown(): Future<MarkdownString> {
		const base64 = await this.fetchImageToBase64();
		if (base64.isError()) {
			return Err(base64.unwrapErr());
		}
		return Ok(new MarkdownString(`![Preview of ${this.getDisplayName()}](data:image/png;base64,${base64.unwrap()})`));
	}

	/**
	 * Get a list of code actions for this resource
	 */
	abstract getSnippetOptions(): SnippetOption[];

	abstract getFileName(): string;

	/**
	 * Get the name of this resource in code, like `"sprite-name.png"_spr`
	 */
	getUsageCode(): string {
		const fileName = this.getFileName();
		if (this.#source instanceof Project) {
			// If this resource is from the currently active project, suffix 
			// with _spr
			if (this.#source.isActive()) {
				return `"${fileName}"_spr`;
			}
			// Otherwise suffix with mod ID
			else {
				return `"${this.#source.getModJson().id}/${fileName}"`;
			}
		}
		else if (this.#source instanceof GeodeSDK) {

		}
		// Otherwise use filename as is
		return `"${fileName}"`;
	}
}

export abstract class FileResource extends Resource {
	#path: string;

	constructor(source: Source, path: string) {
		super(source);
		this.#path = path;
	}

	public containedInPath(path: string): boolean {
		return removeQualityDecorators(this.#path) === removeQualityDecorators(path);
	}

	getID(): string {
		return this.#path;
	}
	getFilePath(): string {
		return this.#path;
	}
	getDisplayName(): string {
		return removeQualityDecorators(basename(this.#path));
	}
	getFileName(): string {
		return removeQualityDecorators(basename(this.#path));
	}
}

export class UnknownResource extends FileResource {
	constructor(source: Source, path: string) {
		super(source, path);
	}

	async fetchImage(): Future<Buffer> {
		try {
        	return Ok(await readFile(getAsset("unknown-{theme}.png")));
		}
		catch (e) {
			return Err(`Unable to read file: ${e}`);
		}
	}
	getSnippetOptions(): SnippetOption[] {
		return [];
	}
}

export class SpriteResource extends FileResource {
	constructor(source: Source, path: string) {
		super(source, path);
	}

	async fetchImage(): Future<Buffer> {
		try {
        	return Ok(await readFile(this.getFilePath()));
		}
		catch (e) {
			return Err(`Unable to read file: ${e}`);
		}
    }
	getSnippetOptions(): SnippetOption[] {
		const phSpr = new Placeholder(`${formPlaceholderName(this.getDisplayName())}Spr`);
		const phBtn = new Placeholder(`${formPlaceholderName(this.getDisplayName())}Btn`);
		const phBtnSpr = new Placeholder(`${formPlaceholderName(this.getDisplayName())}BtnSpr`);
		const phCallback = new Placeholder("");
		const phThis = new Placeholder("this");
		const phText = new Placeholder('"Hi mom!"');
		const phFont = new Placeholder('"bigFont.fnt"');
		return [
			{
				name: "Create CCSprite",
				snippet: snippet`
					CCSprite::create(${this.getUsageCode()})
				`,
			},
			{
				name: "Create CCSprite & Add Child",
				snippet: snippet`
					auto ${phSpr} = CCSprite::create(${this.getUsageCode()});
					${phThis}->addChild(${phSpr});
				`,
			},
			{
				name: "Create Button & Add Child",
				snippet: snippet`
					auto ${phBtnSpr} = CCSprite::create(${this.getUsageCode()});

					auto ${phBtn} = CCMenuItemSpriteExtra::create(
						${phBtnSpr}, ${phThis}, menu_selector(${phCallback})
					);
					${phThis}->addChild(${phBtn});
				`,
			},
			{
				name: "Create Button w/ ButtonSprite & Add Child",
				snippet: snippet`
					auto ${phBtnSpr} = ButtonSprite::create(${phText}, ${phFont}, ${this.getUsageCode()}, .8f);

					auto ${phBtn} = CCMenuItemSpriteExtra::create(
						${phBtnSpr}, ${phThis}, menu_selector(${phCallback})
					);
					${phThis}->addChild(${phBtn});
				`,
			},
		];
	}
}

export class FontResource extends FileResource {
	constructor(source: Source, path: string) {
		super(source, path);
	}

	async fetchImage(): Future<Buffer> {
		const font = await BMFontDatabase.get().loadFont(this.getFilePath());
		if (font.isError()) {
			return Err(font.unwrapErr());
		}
		return await font.unwrap().render("Abc123");
	}
	getSnippetOptions(): SnippetOption[] {
		const phLabel = new Placeholder(`${formPlaceholderName(this.getDisplayName())}Label`);
		const phBtn = new Placeholder(`${formPlaceholderName(this.getDisplayName())}Btn`);
		const phBtnSpr = new Placeholder(`${formPlaceholderName(this.getDisplayName())}BtnSpr`);
		const phCallback = new Placeholder("");
		const phThis = new Placeholder("this");
		const phText = new Placeholder('"Hi mom!"');
		const phButtonSprite = new Placeholder('"GJ_button_01.png"');
		return [
			{
				name: "Create Label",
				snippet: snippet`
					CCLabelBMFont::create(${phText}, ${this.getUsageCode()})
				`,
			},
			{
				name: "Create Label & Add Child",
				snippet: snippet`
					auto ${phLabel} = CCLabelBMFont::create(${phText}, ${this.getUsageCode()});
					${phThis}->addChild(${phLabel});
				`,
			},
			{
				name: "Create Button w/ ButtonSprite & Add Child",
				snippet: snippet`
					auto ${phBtnSpr} = ButtonSprite::create(${phText}, ${this.getUsageCode()}, ${phButtonSprite}, .8f);

					auto ${phBtn} = CCMenuItemSpriteExtra::create(
						${phBtnSpr}, ${phThis}, menu_selector(${phCallback})
					);
					${phThis}->addChild(${phBtn});
				`,
			},
		];
	}
}

export class AudioResource extends FileResource {
	constructor(source: Source, path: string) {
		super(source, path);
	}

	async fetchImage(): Future<Buffer> {
		try {
        	return Ok(await readFile(getAsset("audio-{theme}.png")));
		}
		catch (e) {
			return Err(`Unable to read file: ${e}`);
		}
	}
	getSnippetOptions(): SnippetOption[] {
		return [
			{
				name: "Play Audio as Effect",
				snippet: snippet`
					FMODAudioEngine::sharedEngine()->playEffect(${this.getUsageCode()})
				`,
			},
		];
	}
}

export class SpriteSheetResource extends FileResource {
	#frames: SpriteFrameResource[];

	constructor(source: Source, path: string) {
		super(source, path);
		this.#frames = [];
	}

	public getFrames(): SpriteFrameResource[] {
		return this.#frames;
	}
	public addFrame(frame: SpriteFrameResource) {
		this.#frames.push(frame);
	}

	async fetchImage(): Future<Buffer> {
		// If this is a sheet from a mod, then it won't be an actual spritesheet 
		// but instead just a list of image files that CLI will later combine 
		// into a spritesheet
		// So we need to manually construct the image in that case
		if (this.getSource() instanceof Project) {
			const images = await Promise.all([
				0,
				Math.floor(this.#frames.length / 3),
				Math.floor(this.#frames.length / 2),
				Math.floor(this.#frames.length / 1.5),
			].map(async i => (await this.#frames[i].fetchImage()).map(i => sharp(i))));
			for (const img of images) {
				if (img.isError()) {
					return Err(img.unwrapErr());
				}
			}
			return await createCoverImage(images.map(i => i.unwrap()));
		}
		// Otherwise do actually let the spritesheet itself deal with this
		else {
			const sheet = await SpriteSheetDatabase.get().loadSheet(this.getFilePath());
			if (sheet.isError()) {
				return Err(sheet.unwrapErr());
			}
			return await sheet.unwrap().renderCoverImage();
		}
	}
	getSnippetOptions(): SnippetOption[] {
		return [];
	}
}

export class SpriteFrameResource extends Resource {
	#sheet: SpriteSheetResource;
	#frameOrPath: string;
	#isPath: boolean;

	constructor(source: Source, sheet: SpriteSheetResource, frameOrPath: string, isPath = false) {
		super(source);
		this.#sheet = sheet;
		this.#frameOrPath = frameOrPath;
		this.#isPath = isPath;
	}

	getSheet(): SpriteSheetResource {
		return this.#sheet;
	}
	getFilePath(): Option<string> {
		return this.#isPath ? this.#frameOrPath : None;
	}

	getID(): string {
		return this.#isPath ? this.#frameOrPath : `${this.#sheet.getID()}::${this.#frameOrPath}`;
	}
	getDisplayName(): string {
		return this.#isPath ? removeQualityDecorators(basename(this.#frameOrPath)) : this.#frameOrPath;
	}
	getFileName(): string {
		return this.#isPath ? removeQualityDecorators(basename(this.#frameOrPath)) : this.#frameOrPath;
	}
	async fetchImage(): Future<Buffer> {
		if (this.#isPath) {
			try {
				return Ok(await readFile(this.#frameOrPath));
			}
			catch (e) {
				return Err(`Unable to read file: ${e}`);
			}
		}
		else {
			const sheet = await SpriteSheetDatabase.get().loadSheet(this.#sheet.getFilePath());
			if (sheet.isError()) {
				return Err(sheet.unwrapErr());
			}
			const res = await sheet.unwrap().extract(this.#frameOrPath);
			if (res.isValue()) {
				const val = res.unwrap();
				if (val) {
					return Ok(val);
				}
				else {
					return Err("Unable to load image");
				}
			} else {
				return Err(res.unwrapErr());
			}
		}
	}
	getSnippetOptions(): SnippetOption[] {
		const phSpr = new Placeholder(`${formPlaceholderName(this.getDisplayName())}Spr`);
		const phBtn = new Placeholder(`${formPlaceholderName(this.getDisplayName())}Btn`);
		const phBtnSpr = new Placeholder(`${formPlaceholderName(this.getDisplayName())}BtnSpr`);
		const phCallback = new Placeholder("");
		const phThis = new Placeholder("this");
		return [
			{
				name: "Create CCSprite",
				snippet: snippet`
					CCSprite::createWithSpriteFrameName(${this.getUsageCode()})
				`,
			},
			{
				name: "Create CCSprite & Add Child",
				snippet: snippet`
					auto ${phSpr} = CCSprite::createWithSpriteFrameName(${this.getUsageCode()});
					${phThis}->addChild(${phSpr});
				`,
			},
			{
				name: "Create Button & Add Child",
				snippet: snippet`
					auto ${phBtnSpr} = CCSprite::createWithSpriteFrameName(${this.getUsageCode()});

					auto ${phBtn} = CCMenuItemSpriteExtra::create(
						${phBtnSpr}, ${phThis}, menu_selector(${phCallback})
					);
					${phThis}->addChild(${phBtn});
				`,
			},
		];
	}
}
