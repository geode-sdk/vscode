
import { readFileSync } from 'fs';
import { parse, PlistValue } from 'plist';
import * as sharp from 'sharp';
import { Err, Future, None, Ok, Option } from '../utils/monads';

interface SpriteFrame {
    aliases: string[],
    spriteOffset: string,
    spriteSize: string,
    spriteSourceSize: string,
    textureRect: string,
    textureRotated: boolean,
    frame: string,
}

interface SpriteTexture {
    x: number,
    y: number,
    width: number,
    height: number,
    rotated: boolean,
}

interface SpriteSheetPlist {
    frames: { [name: string]: SpriteFrame }
}

function textureFromFrame(frame: SpriteFrame): SpriteTexture {
    // since the textureRect is formatted as {{x, y}, {w, h}}
    // we can just convert the {} to [] and parse it into an array lol
    const rect = (JSON.parse((frame.textureRect ?? frame.frame)
        .replace(/{/g, '[')
        .replace(/}/g, ']')
    ) as number[][]).flat();
    return {
        x: rect[0],
        y: rect[1],
        width: frame.textureRotated ? rect[3] : rect[2],
        height: frame.textureRotated ? rect[2] : rect[3],
        rotated: frame.textureRotated
    };
}

export async function createCoverImage(sprites: sharp.Sharp[]): Future<string> {
    const images = await Promise.all(
        sprites.map(async (image, ix) => {
            return {
                input: await sharp((await image.toBuffer()))
                    .resize(50, 50, { fit: 'inside' })
                    .toBuffer(),
                left: ix % 2 * 50,
                top: ix > 1 ? 50 : 0
            };
        })
    );
    return Ok(
        await sharp({
            create: {
                width: 100,
                height: 100,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0, },
            },
        })
        .png()
        .composite(images)
        .toBuffer()
        .then(b => b.toString('base64'))
    );
}

export class Sheet {
    #data: SpriteSheetPlist;
    #path: string;

    constructor(data: SpriteSheetPlist, path: string) {
        this.#data = data;
        this.#path = path;
    }

    getPath(): string {
        return this.#path;
    }

    static createFromFile(path: string): Sheet {
        const plistData = readFileSync(path).toString();
        // todo: make this safe
        return new Sheet(parse(plistData) as unknown as SpriteSheetPlist, path);
    }

    private async extractImage(name: string): Future<sharp.Sharp> {
        const file = readFileSync(this.#path.replace('.plist', '.png'));
        let frameData: SpriteFrame | null = null;
        for (const frame in this.#data.frames) {
            if (frame === name) {
                frameData = this.#data.frames[frame];
            }
        }
        if (!frameData) {
            return Err(`Frame '${name}' not found`);
        }
        const tex = textureFromFrame(frameData);
        return Ok(
            sharp(file)
            .extract({
                left: tex.x,
                top: tex.y,
                width: tex.width,
                height: tex.height,
            })
            .rotate(tex.rotated ? -90 : 0)
        );
    }

    async coverImage(): Future<string> {
        const frameCount = Object.keys(this.#data.frames).length;
        if (!frameCount) {
            return Err('Empty sheet');
        }
        try {
            const images = await Promise.all(
                [
                    0,
                    Math.floor(frameCount / 3),
                    Math.floor(frameCount / 2),
                    Math.floor(frameCount / 1.5),
                ]
                .map(async img => await this.extractImage(Object.keys(this.#data.frames)[img]))
                .map(async img => (await img).try())
            );
            return await createCoverImage(images);
        } catch(err: any) {
            return Err(err.toString());
        }
    }

    async extract(name: string): Future<string> {
        return await (await this.extractImage(name)).awaitMap(
            async v => (await v.toBuffer()).toString('base64')
        );
    }
}

export class SheetDatabase {
    sheets: Sheet[] = [];

    public async loadSheet(path: string): Future<Sheet> {
        const loaded = this.sheets.find(sheet => sheet.getPath() === path);
        if (loaded) {
            return Ok(loaded);
        }
        const sheet = Sheet.createFromFile(path);
        if (!sheet) {
            return Err("Unable to load sheet");
        }
        this.sheets.push(sheet);
        return Ok(sheet);
    }
}

const DATABASE = new SheetDatabase();
export function getSheetDatabase() {
    return DATABASE;
}


