import { readFileSync } from "fs";
import { Char, FontData, parseFnt } from "../../utils/fntData";
import { dirname, join } from "path";
import { Jimp, JimpInstance } from "jimp";

export abstract class IFont {

    protected readonly path: string;

    constructor(path: string) {
        this.path = path;
    }

    public abstract render(text: string): Promise<Buffer>;

    public getPath(): string {
        return this.path;
    }

    protected clearBuffer(width: number, height: number): JimpInstance {
        return new Jimp({
            width,
            height,
            color: 0x00000000
        });
    }
}

export class TrueTypeFont extends IFont {

    constructor(path: string) {
        super(path);
    }

    public override async render(): Promise<Buffer> {
        throw "True Type Font rendering isn't supported yet.";
    }
}

export class BMFont extends IFont {

    public static createFromFntFile(path: string): BMFont | undefined {
        const font = parseFnt(readFileSync(path).toString());

        if (font) {
            return new BMFont(font, path);
        } else {
            return undefined;
        }
    }

    private readonly data: FontData;

    constructor(data: FontData, path: string) {
        super(path);

        this.data = data;
    }

    public async render(text: string): Promise<Buffer> {
        let totalWidth = 0;
        const chars: { data: JimpInstance, c: Char }[] = [];

        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            // Try to find the character, if it's not present, subtract 0x20 to get the capital version
            const char = this.data.chars.find((char) => char.id == charCode) ?? this.data.chars.find((char) => char.id == charCode - 0x20);

            if (char) {
                const file = readFileSync(join(dirname(this.path), this.data.pages[char.page]));

                chars.push({
                    data: (await Jimp.read(file)).crop({
                        x: char.x,
                        y: char.y,
                        w: char.width,
                        h: char.height
                    }) as JimpInstance,
                    c: char
                });

                if (i < text.length - 1) {
                    totalWidth += char.xadvance;
                } else {
                    totalWidth += char.width + char.xoffset;
                }
            }
        }

        let x = 0;
        const buffer = this.clearBuffer(totalWidth, this.data.common.lineHeight);

        for (const char of chars) {
            buffer.composite(char.data, x + char.c.xoffset, char.c.yoffset);

            x += char.c.xadvance;
        }

        return buffer.getBuffer("image/png");
    }
}

export class BMFontDatabase {

    private static readonly sharedInstance: BMFontDatabase = new BMFontDatabase();

    public static get(): BMFontDatabase {
        return this.sharedInstance;
    }

    private readonly fonts = new Map<string, IFont>();

    public loadFont(path: string): IFont {
        if (this.fonts.has(path)) {
            return this.fonts.get(path)!;
        }

        let font: IFont | undefined;

        if (path.endsWith(".fnt")) {
            if (!(font = BMFont.createFromFntFile(path))) {
                throw new Error("Unable to create font");
            }
        } else {
            font = new TrueTypeFont(path);
        }

        this.fonts.set(path, font);

        return font;
    }
}
