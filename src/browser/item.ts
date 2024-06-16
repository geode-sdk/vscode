import { readFileSync } from 'node:fs';
import type { TextEditor } from 'vscode';
import { SnippetString } from 'vscode';
import sharp from 'sharp';
import { getAsset } from '../config';
import type { cli } from '../geode/cli';
import type { Project } from '../project/project';
import { getActiveProject, typeIsProject } from '../project/project';
import { insertSnippet, createPlaceholder as ph, createPlaceholderName as phn, snippet } from '../project/source';
import type { Future, Option } from '../utils/monads';
import { Err, None, Ok } from '../utils/monads';
import { removeFromArray } from '../utils/utils';
import { getBMFontDatabase } from './BMFontDatabase';
import { browser } from './browser';
import { createCoverImage, getSheetDatabase } from './SheetDatabase';

export enum ItemType {
	sprite,
	sheet,
	sheetSprite,
	font,
	audio,
}

export function itemTypeID(type: ItemType) {
	return ItemType[type];
}

export type Source = string | cli.Profile | Project;

export function sourceID(src: Source): string {
	if (typeof (src) === 'string')
		return `dir:${src}`;
	else if (typeIsProject(src))
		return `mod:${src.modJson.id}`;
	else
		return `gd:${src.name}`;
}

export interface Item<T extends ItemType> {
	type: T;
	name: string;
	path: string;
	src: Source;
}

export interface ItemLocator {
	srcID: string;
	type: ItemType;
	sheet?: string;
	name: string;
}

export function getItemLocator(item: Item<ItemType>): ItemLocator {
	if (item.type === ItemType.sheetSprite)
		return {
			srcID: sourceID(item.src),
			name: item.name,
			sheet: (item as SheetSpriteItem).sheet,
			type: item.type,
		};

	return {
		srcID: sourceID(item.src),
		name: item.name,
		type: item.type,
	};
}

export function sameLocator(a: ItemLocator, b: ItemLocator) {
	return (
		a.name === b.name
		&& a.srcID === b.srcID
		&& a.type === b.type
		&& a.sheet === b.sheet
	);
}

export interface SheetSpriteItem extends Item<ItemType.sheetSprite> {
	sheet: string;
}

export interface SheetItem extends Item<ItemType.sheet> {
	items: Item<ItemType>[];
}

export async function fetchItemImage<T extends ItemType>(item: Item<T>): Future<string> {
	switch (item.type) {
		case ItemType.sheetSprite: {
			const sheet = await getSheetDatabase().loadSheet(item.path);
			if (sheet.isError())
				return Err(sheet.unwrapErr());

			const res = await sheet.unwrap().extract(item.name);
			if (res.isValue()) {
				const val = res.unwrap();
				if (val)
					return Ok(val);
				else
					return Err('Unable to load image');
			}
			else {
				return Err(res.unwrapErr());
			}
		}

		case ItemType.sheet: {
			if (typeIsProject(item.src)) {
				const sheet = item as unknown as SheetItem;
				const frameCount = sheet.items.length;
				return await createCoverImage([
					0,
					Math.floor(frameCount / 3),
					Math.floor(frameCount / 2),
					Math.floor(frameCount / 1.5),
				].map(i => sharp(sheet.items[i].path)));
			}
			else {
				const sheet = await getSheetDatabase().loadSheet(item.path);
				if (sheet.isError())
					return Err(sheet.unwrapErr());

				return await sheet.unwrap().coverImage();
			}
		}

		case ItemType.font: {
			const font = await getBMFontDatabase().loadFont(item.path);
			if (font.isError())
				return Err(font.unwrapErr());

			return await font.unwrap().render('Abc123');
		}

		case ItemType.audio: {
			return Ok(readFileSync(
				getAsset('audio-{theme}.png'),
				{ encoding: 'base64' },
			));
		}

		case ItemType.sprite: {
			return Ok(readFileSync(item.path, { encoding: 'base64' }));
		}
	}
	return Err('Unsupported type');
}

export class Collection {
	id: string;
	name: string;
	sheets: SheetItem[] = [];
	sprites: Item<ItemType.sprite>[] = [];
	fonts: Item<ItemType.font>[] = [];
	audio: Item<ItemType.audio>[] = [];
	src: Source;

	constructor(src: Source, id?: string) {
		if (typeof (src) === 'string')
			this.name = src;
		else if (typeIsProject(src))
			this.name = `${src.modJson.name} (${src.path})`;
		else
			this.name = `${src.name} (${src.gdPath})`;

		this.id = id ?? sourceID(src);
		this.src = src;
	}

	merge(others: Collection[]): Collection {
		others.forEach((other) => {
			this.sheets = this.sheets.concat(other.sheets);
			this.sprites = this.sprites.concat(other.sprites);
			this.fonts = this.fonts.concat(other.fonts);
			this.audio = this.audio.concat(other.audio);
		});
		return this;
	}

	get(what: string): Item<ItemType>[] {
		switch (what) {
			case 'all': {
				return (this.sheets as Item<ItemType>[])
					.concat(this.sheets.flatMap(s => s.items))
					.concat(this.sprites)
					.concat(this.fonts)
					.concat(this.audio)
				// this is so the 'All' tab in favorites only shows
				// favorited items exclusively
					.filter(i => this.id !== 'favorites' || browser.getDatabase().isFavorite(i));
			}
			case 'sheets': return this.sheets;
			case 'frames': return this.sheets.flatMap(s => s.items);
			case 'sprites': return this.sprites;
			case 'fonts': return this.fonts;
			case 'audio': return this.audio;
			default: {
				const sheet = this.sheets.find(s => s.name === what);
				if (sheet)
					return sheet.items;
				else
					console.warn(`Unknown collection '${what}'`);
			} break;
		}
		return [];
	}

	find(locator: ItemLocator): Option<Item<ItemType>> {
		switch (locator.type) {
			case ItemType.sprite: {
				return this.sprites.find(i => i.name === locator.name);
			}

			case ItemType.font: {
				return this.fonts.find(i => i.name === locator.name);
			}

			case ItemType.sheet: {
				return this.sheets.find(i => i.name === locator.name);
			}

			case ItemType.audio: {
				return this.audio.find(i => i.name === locator.name);
			}

			case ItemType.sheetSprite: {
				try {
					return this.sheets.find(s => s.name === locator.sheet)
						?.items.find(i => i.name === locator.name);
				}
				catch {
					return None;
				}
			}
		}
	}

	findByName(name: string): Option<Item<ItemType>> {
		for (const sheet of this.sheets) {
			const item = sheet.items.find(i => i.name === name);
			if (item)
				return item;
		}
		return this.sprites.find(i => i.name === name)
			?? this.fonts.find(i => i.name === name)
			?? this.audio.find(i => i.name === name);
	}

	add(item: Item<ItemType>) {
		switch (item.type) {
			case ItemType.sprite:
				this.sprites.push(item as Item<ItemType.sprite>);
				break;

			case ItemType.font:
				this.fonts.push(item as Item<ItemType.font>);
				break;

			case ItemType.sheet:
				this.sheets.push(item as SheetItem);
				break;

			case ItemType.audio:
				this.audio.push(item as Item<ItemType.audio>);
				break;

			case ItemType.sheetSprite:
				this.sheets.find(
					s => s.name === (item as SheetSpriteItem).sheet,
				)?.items.push(item as SheetSpriteItem);
				break;
		}
	}

	remove(item: Item<ItemType>) {
		switch (item.type) {
			case ItemType.sprite:
				removeFromArray(this.sprites, item);
				break;

			case ItemType.font:
				removeFromArray(this.fonts, item);
				break;

			case ItemType.sheet:
				removeFromArray(this.sheets, item);
				break;

			case ItemType.audio:
				removeFromArray(this.audio, item);
				break;

			case ItemType.sheetSprite: {
				const sheet = this.sheets.find(
					s => s.name === (item as SheetSpriteItem).sheet,
				);
				if (sheet)
					removeFromArray(sheet.items, item);
			} break;
		}
	}

	getTotalCount() {
		// this is so the 'All' tab in favorites only shows
		// favorited items exclusively
		if (this.id === 'favorites')
			return this.sprites.length
				+ this.fonts.length
				+ this.audio.length
				+ this.sheets.length;

		return (
			this.sprites.length
			+ this.fonts.length
			+ this.audio.length
			+ this.sheets.length
			+ this.sheets.reduce((a, b) => a + b.items.length, 0)
		);
	}

	getFontCount() {
		return this.fonts.length;
	}

	getSheetCount() {
		return Object.entries(this.sheets).length;
	}

	getSheetSpriteCount() {
		return this.sheets.reduce((a, s) => a + s.items.length, 0);
	}

	getSpriteCount() {
		return this.sprites.length;
	}

	getAudioCount() {
		return this.audio.length;
	}
}

export function collectionID(collection: Collection): string {
	return sourceID(collection.src);
}

export function getItemUseText(item: Item<ItemType>): string {
	if (typeIsProject(item.src))
		if (item.src.modJson.id === getActiveProject()?.modJson.id)
			return `"${item.name}"_spr`;
		else
			return `"${item.src.modJson.id}/${item.name}"`;

	return `"${item.name}"`;
}

export async function useItem(item: Item<ItemType>, editor?: TextEditor): Future {
	const res = await insertSnippet(
		new SnippetString(getItemUseText(item)),
		editor,
	);
	if (res.isError())
		return res;

	return Ok();
}

export interface SnippetOption {
	name: string;
	snippet: SnippetString;
}

export function getSnippetOptions(item: Item<ItemType>): SnippetOption[] {
	switch (item.type) {
		case ItemType.sheetSprite: {
			return [
				{
					name: 'Create CCSprite',
					snippet: snippet`
                        CCSprite::createWithSpriteFrameName(${
                            getItemUseText(item)
                        })
                    `,
				},
				{
					name: 'Create CCSprite & Add Child',
					snippet: snippet`
                        auto ${phn(item, 0, 'Spr')} = CCSprite::createWithSpriteFrameName(${
                            getItemUseText(item)
                        });
                        ${ph('this', 1)}->addChild(${phn(item, 0, 'Spr')});
                    `,
				},
				{
					name: 'Create Button & Add Child',
					snippet: snippet`
                        auto ${phn(item, 0, 'BtnSpr')} = CCSprite::createWithSpriteFrameName(${
                            getItemUseText(item)
                        });
                        auto ${phn(item, 1, 'Btn')} = CCMenuItemSpriteExtra::create(
                            ${phn(item, 0, 'BtnSpr')}, ${ph('this', 2)}, menu_selector(${ph('', 3)})
                        );
                        ${ph('this', 2)}->addChild(${phn(item, 1, 'Btn')});
                    `,
				},
			];
		}

		case ItemType.sprite: {
			return [
				{
					name: 'CCSprite',
					snippet: snippet`
                        CCSprite::create(${phn(item, 0)})
                    `,
				},
				{
					name: 'Create CCSprite & Add Child',
					snippet: snippet`
                        auto ${phn(item, 0, 'Spr')} = CCSprite::create(${
                            getItemUseText(item)
                        });
                        ${ph('this', 1)}->addChild(${phn(item, 0, 'Spr')});
                    `,
				},
				{
					name: 'Create Button & Add Child',
					snippet: snippet`
                        auto ${phn(item, 0, 'BtnSpr')} = CCSprite::create(${
                            getItemUseText(item)
                        });

                        auto ${phn(item, 1, 'Btn')} = CCMenuItemSpriteExtra::create(
                            ${phn(item, 0, 'BtnSpr')}, ${ph('this', 2)}, menu_selector(${ph('', 3)})
                        );
                        ${ph('this', 2)}->addChild(${phn(item, 1, 'Btn')});
                    `,
				},
				{
					name: 'Create Button w/ ButtonSprite & Add Child',
					snippet: snippet`
                        auto ${phn(item, 0, 'BtnSpr')} = ButtonSprite::create(${
                            ph('"Hi mom!"', 1)
                        }, ${ph('"bigFont.fnt"', 2)}, ${getItemUseText(item)}, .8f);

                        auto ${phn(item, 3, 'Btn')} = CCMenuItemSpriteExtra::create(
                            ${phn(item, 0, 'BtnSpr')}, ${ph('this', 4)}, menu_selector(${ph('', 5)})
                        );
                        ${ph('this', 4)}->addChild(${phn(item, 3, 'Btn')});
                    `,
				},
			];
		}

		case ItemType.font: {
			return [
				{
					name: 'Create Label',
					snippet: snippet`
                        CCLabelBMFont::create(${ph('"Hi mom!"', 0)}, ${getItemUseText(item)})
                    `,
				},
				{
					name: 'Create Label & Add Child',
					snippet: snippet`
                        auto ${phn(item, 0, 'Label')} = CCLabelBMFont::create(${
                            ph('"Hi mom!"', 1)
                        }, ${getItemUseText(item)});
                        ${ph('this', 2)}->addChild(${phn(item, 0, 'Label')});
                    `,
				},
				{
					name: 'Create Button w/ ButtonSprite & Add Child',
					snippet: snippet`
                        auto ${phn(item, 0, 'BtnSpr')} = ButtonSprite::create(${
                            ph('"Hi mom!"', 1)
                        }, ${getItemUseText(item)}, ${ph('"GJ_button_01.png"', 2)}, .8f);

                        auto ${phn(item, 3, 'Btn')} = CCMenuItemSpriteExtra::create(
                            ${phn(item, 0, 'BtnSpr')}, ${ph('this', 4)}, menu_selector(${ph('', 5)})
                        );
                        ${ph('this', 4)}->addChild(${phn(item, 3, 'Btn')});
                    `,
				},
			];
		}

		case ItemType.audio: {
			return [];
		}

		case ItemType.sheet: {
			return [];
		}
	}
}
