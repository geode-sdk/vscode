import { Hover, HoverProvider, Position, ProviderResult, Range, TextDocument } from "vscode";
import { Option } from "../utils/monads";
import { Resource, SpriteFrameResource } from "../project/resources/Resource";
import { Project } from "../project/Project";
import { ResourceDatabase } from "../project/resources/ResourceDatabase";

function getMatch(document: TextDocument, position: Position, regex: RegExp): Option<{
    text: string,
    groups: Record<string, string | undefined>,
    range: Range
}> {
    const lines = document.getText().split("\n");

    for (let line = 0; line < lines.length; line++) {
        for (const match of lines[line].matchAll(regex)) {
            if (!match.index) {
                continue;
            }

            const range = new Range(new Position(line, match.index), new Position(line, match.index + match[0].length));

            if (range.contains(position)) {
                return {
                    text: match[0],
                    groups: match.groups ?? {},
                    range
                };
            }
        }
    }
    return undefined;
}

export class SpriteHoverPreview implements HoverProvider {

    public provideHover(document: TextDocument, position: Position): ProviderResult<Hover> {
        const match = getMatch(document, position, Resource.RESOURCE_NAME_MATCH_REGEX);

        if (match) {
            let { modID, name, suffix } = match.groups;
            // name is a guaranteed-to-match group
            const resource = ResourceDatabase.get().tryFindResourceFromUse(document.uri, modID, name!, suffix != undefined);

            if (resource) {
                return new Promise(async (resolve) => {
                    resource.fetchImageToMarkdown()
                        .then((md) => {
                            if (resource instanceof SpriteFrameResource) {
                                md.appendText(`\n\nSheet: ${resource.getSheet().getDisplayName()}`);
                            }

                            if (resource.getSource() instanceof Project) {
                                md.appendText(`\n\nMod: ${(resource.getSource() as Project).getModJson().name}`);
                            }

                            resolve(new Hover(md, match.range));
                        })
                        .catch(() => resolve(undefined));
                });
            }
        }

        return undefined;
    }
}
