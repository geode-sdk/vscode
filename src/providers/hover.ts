import {
	CancellationToken,
	Hover,
	HoverProvider,
	Position,
	ProviderResult,
	Range,
	TextDocument,
} from "vscode";
import { None, Option } from "../utils/monads";
import { Resource, RESOURCE_NAME_MATCH_REGEX, sourceID, SpriteFrameResource } from "../project/resources/Resource";
import { Project } from "../project/Project";
import { ResourceDatabase } from "../project/resources/ResourceDatabase";

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
): Option<{ text: string, groups: Record<string, string | undefined>, range: Range }> {
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
				return { text: match[0], groups: match.groups ?? {}, range };
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
		const match = getMatch(document, position, RESOURCE_NAME_MATCH_REGEX);
		if (match) {
			let { modID, name, suffix } = match.groups;

			// name is a guaranteed-to-match group
			const resource = ResourceDatabase.get().tryFindResourceFromUse(document.uri, modID, name!, suffix !== undefined);
			if (resource) {
				return new Promise(async (resolve, _) => {
					const res = await resource.fetchImageToMarkdown();
	
					if (res.isValue()) {
						const content = res.unwrap();
	
						if (resource instanceof SpriteFrameResource) {
							content.appendText(`\n\nSheet: ${resource.getSheet().getDisplayName()}`);
						}
						if (resource.getSource() instanceof Project) {
							content.appendText(`\n\nMod: ${(resource.getSource() as Project).getModJson().name}`);
						}
						resolve(new Hover(content, match.range));
					}
				});
			}
		}

		return undefined;
	}
}
