import { CancellationToken, Hover, HoverProvider, Position, ProviderResult, Range, TextDocument } from "vscode";
import { browser } from "../browser/browser";
import { Item, ItemType, SheetItem, SheetSpriteItem, fetchItemImage, sourceID } from "../browser/item";
import { Option } from "../utils/monads";
import { getProjectFromDocument, typeIsProject } from "./project";

export class SpriteHoverPreview implements HoverProvider {
    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        const lines = document.getText().split('\n');
        for (let line = 0; line < lines.length; line++) {
            for (const match of lines[line].matchAll(/".*?\.(png|fnt|ogg)"(_spr)?/g)) {
                if (!match.index) {
                    continue;
                }
                const range = new Range(
                    new Position(line, match.index),
                    new Position(line, match.index + match[0].length)
                );
                if (!range.contains(position)) {
                    continue;
                }
                let item: Option<Item<ItemType>>;
                if (match[0].endsWith('_spr')) {
                    const name = match[0].substring(1, match[0].length - 5);
                    const project = getProjectFromDocument(document);
                    if (!project) {
                        continue;
                    }
                    const collection = browser.getDatabase().getCollectionById(sourceID(project));
                    item = collection?.findByName(name);
                }
                else {
                    item = browser.getDatabase().findItemByName(
                        match[0].substring(1, match[0].length - 1)
                    );
                }
                if (!item) {
                    continue;
                }
                return new Promise(async (resolve, _) => {
                    const res = await fetchItemImage(item as Item<ItemType>);
                    if (res.isValue()) {
                        let md = '';
                        md += `![Sprite Preview](data:image/png;base64,${res.unwrap()})`;
                        if (item?.type === ItemType.sheetSprite) {
                            md += `\n\nSheet: ${(item as SheetSpriteItem).sheet}`;
                        }
                        if (typeIsProject(item?.src)) {
                            md += `\n\nMod: ${item?.src.modJson.name}`;
                        }
                        resolve(new Hover(md, range));
                    }
                });
            }
        }
        return undefined;
    }
}
