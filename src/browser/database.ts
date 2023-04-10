
import { existsSync, readFileSync } from "fs";
import G = require("glob");
import { basename, join } from "path";
import { getExtConfig } from "../config";
import { cli } from "../geode/cli";
import { getOpenedProjects, Project, typeIsProject } from "../project/project";
import { None, Option } from "../utils/monads";
import { readdirRecursiveSync, removeFromArray } from "../utils/utils";
import { Collection, getItemLocator, Item, ItemLocator, ItemType, sameLocator, SheetItem, Source, sourceID } from "./item";

type SearchPath = Source;

function removeQualityDecorators(file: string) {
    return file.replace(/-uhd|-hd/g, '');
}

function preferredFile(rawFile: string) {
    let ext = '';
    switch (getExtConfig().get<string>('textureQuality')) {
        case 'High':   ext = '-uhd'; break;
        case 'Medium': ext = '-hd'; break;
    }

    // replace suffix
    const file = removeQualityDecorators(rawFile)
        .replace('.png', `${ext}.png`)
        .replace('.plist', `${ext}.plist`);

    // return preferred quality file if it exists, and original if not
    return existsSync(file) ? file : rawFile;
}

export class Database {
    private collections: Collection[] = [];
    private favorites: ItemLocator[] = [];

    private getSearchPaths(): SearchPath[] {
        let res: SearchPath[] = [];

        let gdResources = cli.getCurrentProfile();
        if (gdResources) {
            res.push(gdResources);
        }
        res = res.concat(getOpenedProjects().filter(p => p.hasResources()));

        return res;
    }

    private addSpritesFromDir(src: Source, dir: string) {
        const collection = this.newCollection(src);

        for (const file of readdirRecursiveSync(dir)) {
            // find spritesheets
            if (file.endsWith('.plist')) {
                // check if this is a spritesheet (does it have a corresponding .png file)
                if (!existsSync(file.replace('.plist', '.png'))) {
                    continue;
                }

                const sheetPath = preferredFile(file);
                const sheetName = removeQualityDecorators(basename(file));

                if (!collection.sheets.some(sheet => sheet.name === sheetName)) {
                    collection.sheets.push({
                        type: ItemType.sheet,
                        name: sheetName,
                        path: sheetPath,
                        src,
                        items: []
                    });
                } else {
                    continue;
                }

                // read sheet data and find all *.png strings inside
                readFileSync(sheetPath).toString().match(/\w+\.png/g)?.forEach(match => {
                    match = removeQualityDecorators(match);
                    // check that this is not the same as tehe sheet (metadata field)
                    if (match.replace('.png', '.plist') !== sheetName) {
                        const sheet = collection.sheets.find(
                            sheet => sheet.name === sheetName
                        ) as SheetItem;
                        // make sure sprite isn't already added to sheet
                        if (!sheet.items.some(spr => spr.name === match)) {
                            sheet.items.push({
                                type: ItemType.sheetSprite,
                                name: match,
                                path: sheetPath,
                                src,
                                sheet: sheetName
                            } as Item<ItemType.sheetSprite>);
                        }
                    }
                });
            }
            // find fonts
            else if (file.endsWith('.fnt')) {
                const fontPath = preferredFile(file);
                const fontName = removeQualityDecorators(basename(file));
                if (!collection.fonts.some(fnt => fnt.name === fontName)) {
                    collection.fonts.push({
                        type: ItemType.font,
                        name: fontName,
                        path: fontPath,
                        src
                    });
                }
            }
            // find audio
            else if (file.endsWith('.ogg')) {
                const audioPath = preferredFile(file);
                const audioName = removeQualityDecorators(basename(file));
                if (!collection.audio.some(fnt => fnt.name === audioName)) {
                    collection.audio.push({
                        type: ItemType.audio,
                        name: audioName,
                        path: audioPath,
                        src
                    });
                }
            }
            // find sprites
            else if (file.endsWith('.png')) {
                const filePath = preferredFile(file);
                const fileName = removeQualityDecorators(basename(file));
                // is this a spritesheet?
                if (collection.sheets.some(sheet => sheet.name === fileName.replace('.png', '.plist'))) {
                    continue;
                }
                // is this a font?
                if (collection.fonts.some(fnt => fnt.name === fileName.replace('.png', '.fnt'))) {
                    continue;
                }
                // has this sprite been added already?
                if (collection.sprites.some(spr => spr.name === fileName)) {
                    continue;
                }
                collection.sprites.push({
                    type: ItemType.sprite,
                    name: fileName,
                    path: filePath,
                    src,
                });
            }
        }
    }

    private addSpritesFromMod(mod: Project) {
        if (!mod.modJson.resources) {
            return;
        }
        
        const globOptions: G.IOptions = {
            cwd: mod.path,
            absolute: true,
        };

        const collection = this.newCollection(mod);

        mod.modJson.resources.files
            ?.flatMap(f => G.glob.sync(f, globOptions))
            .forEach(file => {
            if (file.endsWith('.ogg')) {
                collection.audio.push({
                    type: ItemType.audio,
                    name: basename(file),
                    path: file,
                    src: mod
                });
            } else {
                collection.sprites.push({
                    type: ItemType.sprite,
                    name: basename(file),
                    path: file,
                    src: mod
                });
            }
        });

        Object.entries(mod.modJson.resources.spritesheets ?? {})?.forEach(([sheet, patterns]) => {
            collection.sheets.push({
                type: ItemType.sheet,
                name: sheet,
                path: '',
                src: mod,
                items: patterns.flatMap(p => G.glob.sync(p, globOptions)).map(file => {
                    return {
                        name: basename(file),
                        path: file,
                        type: ItemType.sprite,
                        src: mod,
                        sheet
                    };
                })
            });
        });

        Object.entries(mod.modJson.resources.fonts ?? {}).forEach(([name, font]) => {
            collection.fonts.push({
                name: name,
                path: join(mod.path, font.path),
                type: ItemType.font,
                src: mod
            });
        });
    }

    refresh() {
        // reset database
        this.collections = [];
        for (const path of this.getSearchPaths()) {
            if (typeof(path) === 'string') {
                this.addSpritesFromDir(path, path);
            }
            else if (typeIsProject(path)) {
                this.addSpritesFromMod(path);
            }
            else {
                this.addSpritesFromDir(path, join(path.gdPath, 'Resources'));
            }
        }
    }

    loadFavorites(items: ItemLocator[]) {
        items.forEach(loc  => {
            this.favorites.push(loc);
        });
    }

    getFavorites(): ItemLocator[] {
        return this.favorites;
    }

    addFavorite(item: Item<ItemType>) {
        if (!this.isFavorite(item)) {
            this.favorites.push(getItemLocator(item));
        }
    }

    removeFavorite(item: Item<ItemType>) {
        this.favorites = this.favorites.filter(f => !sameLocator(f, getItemLocator(item)));
    }

    isFavorite(item: Item<ItemType>): boolean {
        return this.favorites.some(f => sameLocator(f, getItemLocator(item)));
    }

    getItemByLocator(locator: ItemLocator): Option<Item<ItemType>> {
        return this.collections.find(
            c => sourceID(c.src) === locator.srcID
        )?.find(locator);
    }

    newCollection(src: Source): Collection {
        const collection = new Collection(src);
        this.collections.push(collection);
        return collection;
    }

    getCollections(): Collection[] {
        return this.collections;
    }

    getCollectionOptions(): { name: string, id: string}[] {
        return [
            { id: 'all', name: 'All' },
            { id: 'favorites', name: 'Favorites' },
        ].concat(this.getCollections());
    }

    getCollectionById(id: string): Collection | undefined {
        if (id === 'all') {
            return new Collection('All', 'all').merge(this.collections);
        }
        if (id === 'favorites') {
            const fav = new Collection('Favorites', 'favorites');
            this.favorites.forEach(loc => {
                const item = this.getItemByLocator(loc);
                if (item) {
                    fav.add(item);
                }
            });
            return fav;
        }
        return this.collections.find(c => c.id === id);
    }

    findItemByName(name: string): Option<Item<ItemType>> {
        for (const c of this.collections) {
            const item = c.findByName(name);
            if (item) {
                return item;
            }
        }
        return undefined;
    }
}
