import { SnippetString, TextEditor, window } from "vscode";
import { Err, Future, Ok } from "./monads";

export class Placeholder {
	#text: string;
	#id: symbol;

	/**
	 * Create a new Placeholder
	 * @param text The default text of the placeholder
	 */
	constructor(text: string) {
		this.#text = text;
		this.#id = Symbol();
	}
	getText(): string {
		return this.#text;
	}
	getSymbol(): symbol {
		return this.#id;
	}
}

type SnippetInsert = string | Placeholder;

export function snippet(
	strs: TemplateStringsArray,
	...fmts: SnippetInsert[]
): SnippetString {
	let spaces: RegExp;
	let snippet = new SnippetString();

	// Assign unique indices to all placeholders starting from 0
	// Note that the same placeholder may be used multiple times!
	const placeholderIndices: { [snippet: symbol]: number } = {};
	for (let fmt of fmts) {
		if (fmt instanceof Placeholder) {
			placeholderIndices[fmt.getSymbol()] = Object.keys(placeholderIndices).length;
		}
	}

	strs.forEach((str, ix, list) => {
		// remove indentation
		if (ix === 0) {
			spaces = new RegExp(
				`^ {${str.match(/^ +/m)?.at(0)?.length ?? 0}}`,
				"gm",
			);
			str = str.trimStart();
		}
		else {
			str = str.replace(spaces, "");
		}
		if (ix === list.length - 1) {
			str = str.trimEnd();
		}
		// insert components
		snippet.appendText(str);
		if (ix < fmts.length) {
			const fmt = fmts[ix];
			if (fmt instanceof Placeholder) {
				snippet.appendPlaceholder(fmt.getText(), placeholderIndices[fmt.getSymbol()]);
			}
			else {
				snippet.appendText(fmt);
			}
		}
	});
	return snippet;
}

export async function insertSnippet(
	snippet: SnippetString,
	editor?: TextEditor,
): Future {
	if (!editor) {
		editor = window.visibleTextEditors[0];
	}
	if (!editor) {
		return Err("No text editor is open");
	}
	try {
		if (await editor.insertSnippet(snippet)) {
			return Ok();
		} else {
			return Err("Snippet could not be inserted");
		}
	} catch (err) {
		return Err(`Snippet could not be inserted: ${err}`);
	}
}
