import { SnippetString, TextEditor, window } from "vscode";
import { Err, Future, Ok, Option } from "./monads";

export class Tabstop {

    private tabstop?: number;

    private readonly originalTabstop?: number;

    constructor(tabstop?: number) {
        this.tabstop = tabstop;
        this.originalTabstop = tabstop;
    }

    public getTabstop(): Option<number> {
        return this.tabstop;
    }

    public setTabstop(tabstop?: number): void {
        this.tabstop = tabstop;
    }

    public reset(): this {
        this.tabstop = this.originalTabstop;

        return this;
    }
}

export class Placeholder extends Tabstop {

    private readonly text: string;

    constructor(text: string, tabstop?: number) {
        super(tabstop);

        this.text = text;
    }

    public getText(): string {
        return this.text;
    }
}

export class Choices extends Tabstop {

    private readonly choices: string[];

    constructor(choices: string[], tabstop?: number) {
        super(tabstop);

        this.choices = choices;
    }

    public getChoices(): string[] {
        return this.choices;
    }
}

export type SnippetInsert = string | Tabstop | Placeholder | Choices;

export class Snippet {

    private static readonly PREFIX_WHITESPACE_FILTER = /^ {2,}| {2,}$/gm;

    public static from(template: string): Snippet;
    public static from(template: TemplateStringsArray, ...options: SnippetInsert[]): Snippet;
    public static from(template: string | TemplateStringsArray, ...options: SnippetInsert[]): Snippet {
        if (typeof template == "string") {
            return new Snippet(template);
        } else {
            return new Snippet(template, ...options);
        }
    }

    private static buildSnippet(template: TemplateStringsArray, ...options: SnippetInsert[]): SnippetString {
        const snippet = new SnippetString();
        const registeredTabstops: Set<number> = new Set(options.filter((option) => option instanceof Object)
            .map((option) => (option as Exclude<SnippetInsert, string>).getTabstop())
            .filter((tabstop) => typeof tabstop == "number") as number[]);
        const parts: string[] = template.raw.map((part) => part.replace(Snippet.PREFIX_WHITESPACE_FILTER, ""));

        parts[0] = parts[0].trimStart();
        parts[template.raw.length - 1] = parts[template.raw.length - 1].trimEnd();

        for (let i = 0; i < template.raw.length; i++) {
            const option = options[i];

            snippet.appendText(parts[i]);

            if (typeof option == "object") {
                let tabstop = option.getTabstop();

                if (typeof tabstop == "undefined") {
                    // Indices should start from 1 and increment unless you explicitly want to make 2 inputs the same
                    for (tabstop = 1; tabstop <= registeredTabstops.size; tabstop++);
                }

                option.setTabstop(tabstop);
                registeredTabstops.add(tabstop);

                if (option instanceof Choices) {
                    snippet.appendChoice(option.getChoices(), tabstop);
                } else if (option instanceof Placeholder) {
                    snippet.appendPlaceholder(option.getText(), tabstop);
                } else {
                    snippet.appendTabstop(tabstop);
                }
            } else if (typeof option == "string") {
                snippet.appendText(option);
            }
        }

        return snippet;
    }

    private readonly snippet: SnippetString;

    private constructor(template: string);
    private constructor(template: TemplateStringsArray, ...options: SnippetInsert[]);
    private constructor(template: string | TemplateStringsArray, ...options: SnippetInsert[]) {
        if (typeof template == "string") {
            this.snippet = new SnippetString(template.replace(Snippet.PREFIX_WHITESPACE_FILTER, "").trim());
        } else {
            this.snippet = Snippet.buildSnippet(template, ...options);
        }
    }

    public async insert(editor?: TextEditor): Future {
        if (!(editor ??= window.visibleTextEditors[0])) {
            return Err("No text editor is open");
        } else if (await editor.insertSnippet(this.snippet)) {
            return Ok();
        } else {
            return Err("Snippet could not be inserted");
        }
    }
}