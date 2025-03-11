import { readFileSync } from "fs";
import { Char, FontData, parseFnt } from "../../utils/fntData";
import { dirname, join } from "path";
import * as sharp from "sharp";
import { Err, Future, Ok } from "../../utils/monads";

function sharpFromClear(width: number, height: number) {
	return sharp(Buffer.alloc(width * height * 4, 0x00000000), {
		raw: {
			width: width,
			height: height,
			channels: 4,
		},
	});
}

export interface IFont {
	path: string;
	render(text: string): Future<Buffer>;
}

export class TrueTypeFont implements IFont {
	path: string;

	constructor(path: string) {
		this.path = path;
	}

	async render(_: string): Future<Buffer> {
		const width = 250;
		const height = 50;

		const svg = `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                <text
                    x="50%"
                    y="100%"
                    text-anchor="middle"
                    font-size="50px"
                    font-family="Comic Sans MS"
                    fill="#fff"
                >No Preview</text>
            </svg>
        `;
		return Ok(
			await sharpFromClear(width, height)
				.composite([
					{
						input: Buffer.from(svg),
						top: 0,
						left: 0,
					},
				])
				.png()
				.toBuffer(),
		);
	}
}

export class BMFont implements IFont {
	path: string;
	data: FontData;

	constructor(data: FontData, path: string) {
		this.data = data;
		this.path = path;
	}

	static createFromFntFile(path: string): BMFont | null {
		const font = parseFnt(readFileSync(path).toString());
		if (!font) {
			return null;
		}
		return new BMFont(font, path);
	}

	async render(text: string): Future<Buffer> {
		interface RenderedChar {
			data: Buffer;
			c: Char;
		}

		let totalWidth = 0;
		let totalHeight = this.data.common.lineHeight + this.data.common.base;
		const chars: RenderedChar[] = [];
		for (let ix = 0; ix < text.length; ix++) {
			const char = this.data.chars.find(
				(ch) => ch.id === text.charCodeAt(ix),
			);
			if (char) {
				const file = readFileSync(
					join(dirname(this.path), this.data.pages[char.page]),
				);
				chars.push({
					data: await sharp(file)
						.extract({
							left: char.x,
							top: char.y,
							width: char.width,
							height: char.height,
						})
						.toBuffer(),
					c: char,
				});
				totalWidth += char.xadvance;
			}
		}
		let x = 0;
		return Ok(
			await sharpFromClear(totalWidth, totalHeight)
				.composite(
					chars.map((char) => {
						const res = {
							input: char.data,
							left: x + char.c.xoffset,
							top: char.c.yoffset + this.data.common.base,
						};
						x += char.c.xadvance;
						return res;
					}),
				)
				.png()
				.toBuffer()
		);
	}
}

export class BMFontDatabase {
	#fonts: IFont[] = [];
	static #sharedInstance: BMFontDatabase = new BMFontDatabase();

	public static get(): BMFontDatabase {
		return this.#sharedInstance;
	}

	public async loadFont(path: string): Future<IFont> {
		const loaded = this.#fonts.find((font) => font.path === path);
		if (loaded) {
			return Ok(loaded);
		}
		let font: IFont | null;
		if (path.endsWith(".fnt")) {
			font = BMFont.createFromFntFile(path);
			if (!font) {
				return Err("Unable to create font");
			}
		} else {
			font = new TrueTypeFont(path);
		}
		this.#fonts.push(font);
		return Ok(font);
	}
}
