import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CancellationToken, HoverProvider, ProviderResult, TextDocument } from 'vscode';
import { Hover, Position, Range } from 'vscode';
import { browser } from '../browser/browser';
import type { Item, SheetSpriteItem } from '../browser/item';
import { ItemType, fetchItemImage, sourceID } from '../browser/item';
import type { Option } from '../utils/monads';
import { getProjectFromDocument, typeIsProject } from './project';

function getLineOfString(text: string, str: string): Option<number> {
	const lines = text.split('\n');
	for (let line = 0; line < lines.length; line++)
		if (lines[line].includes(str))
			return line + 1;

	return undefined;
}

function getMatch(document: TextDocument, position: Position, regex: RegExp): Option<{ text: string; range: Range }> {
	const lines = document.getText().split('\n');
	for (let line = 0; line < lines.length; line++)
		for (const match of lines[line].matchAll(regex)) {
			if (!match.index)
				continue;

			const range = new Range(
				new Position(line, match.index),
				new Position(line, match.index + match[0].length),
			);
			if (range.contains(position))
				return { text: match[0], range };
		}

	return undefined;
}

export class SpriteHoverPreview implements HoverProvider {
	provideHover(document: TextDocument, position: Position, _token: CancellationToken): ProviderResult<Hover> {
		const match = getMatch(document, position, /"[\w\-.]+\.(png|fnt|ogg)"(_spr)?/g);
		if (match) {
			let item: Option<Item<ItemType>>;
			if (match.text.endsWith('_spr')) {
				const name = match.text.substring(1, match.text.length - 5);
				const project = getProjectFromDocument(document);
				if (!project)
					return undefined;

				const collection = browser.getDatabase().getCollectionById(sourceID(project));
				item = collection?.findByName(name);
			}
			else {
				item = browser.getDatabase().findItemByName(
					match.text.substring(1, match.text.length - 1),
				);
			}
			if (!item)
				return undefined;

			// eslint-disable-next-line no-async-promise-executor -- since this is an impl, provideHover cant be async
			return new Promise(async (resolve, _) => {
				const res = await fetchItemImage(item as Item<ItemType>);

				if (res.isValue()) {
					let md = '';
					md += `![Sprite Preview](data:image/png;base64,${res.unwrap()})`;
					if (item?.type === ItemType.sheetSprite)
						md += `\n\nSheet: ${(item as SheetSpriteItem).sheet}`;

					if (typeIsProject(item?.src))
						md += `\n\nMod: ${item?.src.modJson.name}`;

					resolve(new Hover(md, match.range));
				}
			});
		}
		return undefined;
	}
}

export class SettingHover implements HoverProvider {
	provideHover(document: TextDocument, position: Position, _token: CancellationToken): ProviderResult<Hover> {
		const project = getProjectFromDocument(document);
		if (!project || !project.modJson.settings)
			return undefined;

		const match = getMatch(document, position, /(?<=[gs]etSettingValue.*?\(\s*")[a-z0-9\-]+(?="[^)]*\))/g);
		if (match)
			if (match.text in project.modJson.settings) {
				const rawModJson = readFileSync(join(project.path, 'mod.json')).toString();
				const setting = project.modJson.settings[match.text];
				return new Hover(
                    `# ${setting.name ?? match.text}\n\n${setting.description ?? 'No Description'}`
                    + `\n\n[Go to Definition](/${project.path}/mod.json#${getLineOfString(rawModJson, match.text)})`,
                    match.range,
				);
			}
			else {
				// todo: figure out how to make this a linter warning
				return new Hover(`Unknown setting ${match.text}`, match.range);
			}

		return undefined;
	}
}
