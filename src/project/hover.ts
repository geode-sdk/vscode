import {
	CancellationToken,
	Hover,
	HoverProvider,
	MarkdownString,
	Position,
	ProviderResult,
	Range,
	TextDocument,
} from "vscode";
import { browser } from "../browser/browser";
import {
	Item,
	ItemType,
	SheetItem,
	SheetSpriteItem,
	fetchItemImage,
	sourceID,
} from "../browser/item";
import { Option } from "../utils/monads";
import { getProjectFromDocument, typeIsProject } from "./project";
import { readFileSync } from "fs";
import { join } from "path";

function getLineOfString(text: string, str: string): Option<number> {
	const lines = text.split("\n");
	for (let line = 0; line < lines.length; line++) {
		if (lines[line].includes(str)) {
			return line + 1;
		}
	}
	return undefined;
}

function getMatch(
	document: TextDocument,
	position: Position,
	regex: RegExp,
): Option<{ text: string; range: Range }> {
	const lines = document.getText().split("\n");
	for (let line = 0; line < lines.length; line++) {
		for (const match of lines[line].matchAll(regex)) {
			if (!match.index) {
				continue;
			}
			const range = new Range(
				new Position(line, match.index),
				new Position(line, match.index + match[0].length),
			);
			if (range.contains(position)) {
				return { text: match[0], range };
			}
		}
	}
	return undefined;
}

export class SpriteHoverPreview implements HoverProvider {
	provideHover(
		document: TextDocument,
		position: Position,
		token: CancellationToken,
	): ProviderResult<Hover> {
		const match = getMatch(
			document,
			position,
			/"[a-zA-Z0-9_\-\.]+\.(png|fnt|ogg)"(_spr)?/g,
		);
		if (match) {
			let item: Option<Item<ItemType>>;
			if (match.text.endsWith("_spr")) {
				const name = match.text.substring(1, match.text.length - 5);
				const project = getProjectFromDocument(document.uri);
				if (!project) {
					return undefined;
				}
				const collection = browser
					.getDatabase()
					.getCollectionById(sourceID(project));
				item = collection?.findByName(name);
			} else {
				item = browser
					.getDatabase()
					.findItemByName(
						match.text.substring(1, match.text.length - 1),
					);
			}
			if (!item) {
				return undefined;
			}
			return new Promise(async (resolve, _) => {
				const res = await fetchItemImage(item as Item<ItemType>);
				if (res.isValue()) {
					let md = "";
					md += `![Sprite Preview](data:image/png;base64,${res.unwrap()})`;
					if (item?.type === ItemType.sheetSprite) {
						md += `\n\nSheet: ${(item as SheetSpriteItem).sheet}`;
					}
					if (typeIsProject(item?.src)) {
						md += `\n\nMod: ${item?.src.modJson.name}`;
					}
					resolve(new Hover(md, match.range));
				}
			});
		}
		return undefined;
	}
}
