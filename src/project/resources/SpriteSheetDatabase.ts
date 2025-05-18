import { readFileSync } from "fs";
import { parse } from "plist";
import { Jimp } from "jimp";

type JimpReadInstance = Awaited<ReturnType<typeof Jimp["read"]>>;

interface SpriteFrame {
    aliases: string[];
    spriteOffset: string;
    spriteSize: string;
    spriteSourceSize: string;
    textureRect: string;
    textureRotated: boolean;
    frame: string;
}

interface SpriteTexture {
    x: number;
    y: number;
    width: number;
    height: number;
    rotated: boolean;
}

interface SpriteSheetPlist {
    frames: { [name: string]: SpriteFrame };
}

export class Sheet {

    public static async createSheetCoverImage(count: number, imageCallback: (index: number) => Promise<JimpReadInstance>): Promise<Buffer> {
        const targetSize = 100;
        const partSize = targetSize / 2;
        const cover = new Jimp({
            width: targetSize,
            height: targetSize,
            color: 0x00000000
        });

        return Promise.all((count <= 4 ? [...Array(count).keys()] : Array(4).fill(0).map((_, i) => Math.floor(count * 0.25 * i)))
            .map(imageCallback)
            .map((loadingImage, index) => loadingImage.then((image) => {
                // Resize the image to preserve the aspect ratio
                const resize: { w: number, h: number } = image.width > image.height ? {
                    w: partSize,
                    h: partSize * (image.height / image.width)
                } : {
                    w: partSize * (image.width / image.height),
                    h: partSize
                };

                return cover.composite(
                    image.resize(resize),
                    // X = 0 on even and partSize on odd, divide the delta width by 2 to center the image once added
                    index % 2 * partSize + (partSize - resize.w) / 2,
                    // Y = Increments by partSize on every second image, divide the delta height by 2 to center the image once added
                    Math.floor(index / 2) * partSize + (partSize - resize.h) / 2
                );
            })))
            .then(() => cover.getBuffer("image/png"));
    }
    
    public static createFromFile(path: string): Sheet {
        const plistData = readFileSync(path).toString();
        // todo: make this safe
        return new Sheet(parse(plistData) as unknown as SpriteSheetPlist, path);
    }

    private readonly data: SpriteSheetPlist;

    private readonly path: string;

    private readonly sheetCache: Promise<JimpReadInstance>;

    constructor(data: SpriteSheetPlist, path: string) {
        this.data = data;
        this.path = path;
        this.sheetCache = Jimp.read(readFileSync(path.replace(/\.plist$/, ".png")));
    }

    public getPath(): string {
        return this.path;
    }

    public async renderCoverImage(): Promise<Buffer> {
        const frames = Object.keys(this.data.frames);
        const frameCount = frames.length;

        if (!frameCount) {
            throw new Error("Empty sheet");
        }

        return Sheet.createSheetCoverImage(frameCount, (index) => this.extractImage(frames[index]));
    }

    public async extract(name: string): Promise<Buffer> {
        return this.extractImage(name).then((image) => image.getBuffer("image/png"));
    }

    private async extractImage(name: string): Promise<JimpReadInstance> {
        for (const frame in this.data.frames) {
            if (frame == name) {
                const texture = this.textureFromFrame(this.data.frames[frame]);

                return (await this.sheetCache).clone().crop({
                    x: texture.x,
                    y: texture.y,
                    w: texture.width,
                    h: texture.height
                }).rotate(texture.rotated ? 90 : 0) as JimpReadInstance;
            }
        }

        throw new Error(`Frame '${name}' not found`);
    }

    private textureFromFrame(frame: SpriteFrame): SpriteTexture {
        // Since the textureRect is formatted as {{x, y}, {w, h}}
        // We can just convert the {} to [] and parse it into an array lol
        const rect = (JSON.parse((frame.textureRect ?? frame.frame).replace(/{/g, "[").replace(/}/g, "]")) as number[][]).flat();

        return {
            x: rect[0],
            y: rect[1],
            width: frame.textureRotated ? rect[3] : rect[2],
            height: frame.textureRotated ? rect[2] : rect[3],
            rotated: frame.textureRotated
        };
    }
}

export class SpriteSheetDatabase {

    private static readonly sharedInstance = new SpriteSheetDatabase();

    public static get(): SpriteSheetDatabase {
        return this.sharedInstance;
    }

    private readonly sheets = new Map<string, Sheet>();

    public async loadSheet(path: string): Promise<Sheet> {
        if (this.sheets.has(path)) {
            return this.sheets.get(path)!;
        }

        const sheet = Sheet.createFromFile(path);

        if (sheet) {
            this.sheets.set(path, sheet);

            return sheet;
        } else {
            throw Error("Unable to load sheet");
        }
    }
}
