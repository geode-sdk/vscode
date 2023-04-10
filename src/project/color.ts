
import { CancellationToken, Color, ColorInformation, ColorPresentation, DocumentColorProvider, Position, ProviderResult, Range, TextDocument } from "vscode";

export class CCColorProvider implements DocumentColorProvider {
    static singleByte = /((25[0-5])|(2[0-4][0-9])|([0-1][0-9][0-9])|([0-9][0-9]?))/g;
    static evil = /{\s*((25[0-5])|(2[0-4][0-9])|([0-1][0-9][0-9])|([0-9][0-9]?))\s*,\s*((25[0-5])|(2[0-4][0-9])|([0-1][0-9][0-9])|([0-9][0-9]?))(\s*,\s*((25[0-5])|(2[0-4][0-9])|([0-1][0-9][0-9])|([0-9][0-9]?)))?\s*,\s*((25[0-5])|(2[0-4][0-9])|([0-1][0-9][0-9])|([0-9][0-9]?))\s*,?\s*}/g;

    parseIListColor(color: string): Color | undefined {
        const bytes = color.match(CCColorProvider.singleByte);
        if (!bytes || bytes.length < 3 || bytes.length > 4) {
            return undefined;
        }
        if (bytes.length === 3) {
            return new Color(
                parseInt(bytes[0]) / 255,
                parseInt(bytes[1]) / 255,
                parseInt(bytes[2]) / 255,
                1
            );
        }
        return new Color(
            parseInt(bytes[0]) / 255,
            parseInt(bytes[1]) / 255,
            parseInt(bytes[2]) / 255,
            parseInt(bytes[3]) / 255
        );
    }

    makeIListColor(color: Color): string {
        if (color.alpha === 1) {
            return `{ ${
                Math.round(color.red * 255)
            }, ${
                Math.round(color.green * 255)
            }, ${
                Math.round(color.blue * 255)
            } }`;
        }
        return `{ ${
            Math.round(color.red * 255)
        }, ${
            Math.round(color.green * 255)
        }, ${
            Math.round(color.blue * 255)
        }, ${
            Math.round(color.alpha * 255)
        } }`;
    }

    provideDocumentColors(document: TextDocument, token: CancellationToken): ProviderResult<ColorInformation[]> {
        const res = [];
        const lines = document.getText().split('\n');
        for (let line = 0; line < lines.length; line++) {
            for (const match of lines[line].matchAll(CCColorProvider.evil)) {
                const color = this.parseIListColor(match[0]);
                if (match.index && color) {
                    res.push(new ColorInformation(new Range(
                        new Position(line, match.index),
                        new Position(line, match.index + match[0].length)
                    ), color));
                }
            }
        }
        return res;
    }

    provideColorPresentations(color: Color, context: { readonly document: TextDocument; readonly range: Range; }, token: CancellationToken): ProviderResult<ColorPresentation[]> {
        return [new ColorPresentation(this.makeIListColor(color))];
    }
}
