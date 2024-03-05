
import { CancellationToken, Color, ColorInformation, ColorPresentation, DocumentColorProvider, Position, ProviderResult, Range, TextDocument } from "vscode";
import { getOutputChannel } from "../config";

const MATCH_COLOR_BYTE = /\b((25[0-5])|(2[0-4][0-9])|([0-1][0-9][0-9])|([0-9][0-9]?)\b)/g;

class CCColorProvider implements DocumentColorProvider {
    rgba: boolean;

    constructor(rgba: boolean) {
        this.rgba = rgba;
    }
    
    private parseColor(color: string): Color | undefined {
        const bytes = color.match(MATCH_COLOR_BYTE);
        getOutputChannel().appendLine(`got ${bytes?.length} matches`);
        if (!bytes || bytes.length < 3 || bytes.length > (this.rgba ? 4 : 3)) {
            getOutputChannel().appendLine(`didnt barse color ${color}`);
            return undefined;
        }
        return new Color(
            parseInt(bytes[0]) / 255,
            parseInt(bytes[1]) / 255,
            parseInt(bytes[2]) / 255,
            (this.rgba ? (parseInt(bytes[3]) / 255) : 1)
        );
    }

    private generateRegex(): RegExp {
        let regex = "";

        const list = `\\s*${MATCH_COLOR_BYTE.source}\\s*,`.repeat(this.rgba ? 4 : 3);

        // Functional colors
        regex += `(${this.rgba ? 'ccc4' : 'ccc3'}\\s*\\(${list}?\\s*\\))`;

        // Or
        regex += "|";

        // Initializer list
        regex += `({${list}?\\s*})`;

        return new RegExp(regex, 'g');
    }

    private findColorsInCodeLine(num: number, line: string): ColorInformation[] {
        const ret = [];
        if (line.toLowerCase().includes('color') || line.includes(this.rgba ? 'ccc4' : 'ccc3')) {
            getOutputChannel().appendLine(`${line} passed the test`);
            for (const match of line.matchAll(this.generateRegex())) {
                getOutputChannel().appendLine(`${match[0]} matched`);
                const color = this.parseColor(match[0]);
                if (match.index && color) {
                    ret.push(new ColorInformation(
                        new Range(
                            new Position(num, match.index),
                            new Position(num, match.index + match[0].length)
                        ),
                        color
                    ));
                }
            }
        }
        return ret;
    }

    private representColor(color: Color, type: 'initializer' | 'function') {
        const colors = [color.red, color.green, color.blue];
        if (this.rgba) {
            colors.push(color.alpha);
        }
        const list = colors.map(c => (c * 255).toString()).join(', ');
        switch (type) {
            case 'initializer': return `{ ${list} }`;
            case 'function':    return `${this.rgba ? 'ccc4' : 'ccc3'}(${list})`;
        }
    }

    provideDocumentColors(document: TextDocument, token: CancellationToken): ProviderResult<ColorInformation[]> {
        const res = [];
        const lines = document.getText().split('\n');
        for (let line = 0; line < lines.length; line += 1) {
            res.push(...this.findColorsInCodeLine(line, lines[line]));
        }
        return res;
    }

    provideColorPresentations(color: Color, context: { readonly document: TextDocument; readonly range: Range; }, token: CancellationToken): ProviderResult<ColorPresentation[]> {
        return [
            new ColorPresentation(this.representColor(color, 'initializer')),
            new ColorPresentation(this.representColor(color, 'function')),
        ];
    }
}

export class CCColor3bProvider extends CCColorProvider {
    constructor() {
        super(false);
    }
}

export class CCColor4bProvider extends CCColorProvider {
    constructor() {
        super(true);
    }
}
