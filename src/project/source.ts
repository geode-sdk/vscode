import type { TextEditor } from 'vscode';
import { SnippetString, window } from 'vscode';
import camelCase from 'camelcase';
import type { Item, ItemType } from '../browser/item';
import type { Future, Option } from '../utils/monads';
import { Err, Ok } from '../utils/monads';

class Placeholder {
	#prefix?: string;
	#suffix?: string;
	#text: string;
	#index: number;

	constructor(text: string, index: number) {
		this.#text = text;
		this.#index = index;
	}

	getPrefix(): Option<string> {
		return this.#prefix;
	}

	getSuffix(): Option<string> {
		return this.#suffix;
	}

	getIndex(): number {
		return this.#index;
	}

	getText(): string {
		return this.#text;
	}
}

export function createPlaceholderName(item: Item<ItemType>, index: number, ending?: string): Placeholder {
	return new Placeholder(
		camelCase(
			item.name
			// remove number part like _001
			// remove leading prefix like GJ_ if one exists
			// remove all file extensions & -hd and -uhd suffixes
			// remove extra GJ or number parts
				.replace(/(^[a-zA-Z0-9]{0,3}_)|(_\d+)|((-hd|-uhd)?\.[a-z]+)|(GJ|\d+)/g, ''),
		) + (ending ?? ''),
		index,
	);
}

export function createPlaceholder(text: string, index: number): Placeholder {
	return new Placeholder(text, index);
}

type SnippetInsert = string | Placeholder;

export function snippet(
	strs: TemplateStringsArray,
	...fmts: SnippetInsert[]
): SnippetString {
	let spaces: RegExp;
	const snippet = new SnippetString();
	strs.forEach((str, ix, list) => {
		// remove indentation
		if (ix === 0) {
			spaces = new RegExp(`^ {${str.match(/^ +/m)?.at(0)?.length ?? 0}}`, 'gm');
			str = str.trimStart();
		}
		else {
			str = str.replace(spaces, '');
		}
		if (ix === list.length - 1)
			str = str.trimEnd();

		// insert components
		snippet.appendText(str);
		if (ix < fmts.length) {
			const fmt = fmts[ix];
			if (fmt instanceof Placeholder) {
				if (fmt.getPrefix())
					snippet.appendText(fmt.getPrefix() as string);

				snippet.appendPlaceholder(fmt.getText(), fmt.getIndex());
				if (fmt.getSuffix())
					snippet.appendText(fmt.getSuffix() as string);
			}
			else {
				snippet.appendText(fmt);
			}
		}
	});
	return snippet;
}

export async function insertSnippet(snippet: SnippetString, editor?: TextEditor): Future {
	if (!editor)
		editor = window.visibleTextEditors[0];

	if (!editor)
		return Err('No text editor is open');

	try {
		if (await editor.insertSnippet(snippet))
			return Ok();
		else
			return Err('Snippet could not be inserted');
	}
	catch (err) {
		return Err(`Snippet could not be inserted: ${err}`);
	}
}
