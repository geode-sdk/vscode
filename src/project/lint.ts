import { CancellationToken, CodeAction, CodeActionContext, CodeActionKind, CodeActionProvider, Command, Diagnostic, DiagnosticCollection, DiagnosticSeverity, ExtensionContext, languages, Position, ProviderResult, Range, Selection, TextDocument, Uri, workspace, WorkspaceEdit } from "vscode";
import { getProjectFromDocument, typeIsProject } from "./project";
import { readFile } from "fs/promises";
import { browser } from "../browser/browser";
import { parse as parsePath } from "path";
import { Item, ItemType } from "../browser/item";
import { Database } from "../browser/database";

// type Binding = "inline" | "link" | number | null;
// type Bindings = {
//     classes: {
//         name: string,
//         functions: {
//             name: string,
//             args: { type: string, name: string }[],
//             const: boolean,
//             virtual: boolean,
//             static: boolean,
//             bindings: {
//                 win: Binding,
//                 imac: Binding,
//                 m1: Binding,
//                 ios: Binding,
//                 android32: Binding,
//                 android64: Binding,
//             }
//         }[],
//     }[]
// };
// 
// let LOADED_BINDINGS: Bindings | undefined = undefined;

interface MaybeDocument {
    uri: Uri,
    data: string,
}

/**
 * Get the `Position` in a `MaybeDocument` based on a character index
 * @param document A document
 * @param index The index of the character whose line/column position you want
 * @returns The line/column position of the character
 */
function positionAtIndex(document: MaybeDocument, index: number): Position {
    // I'm assuming this is more performant than `data.split('\n')`
    // This def should be performant since this is run for every source file in 
    // the project every time they are saved
    let newlines = 0;
    let lastLineLength = 0;
    for (let i = 0; i < index && i < document.data.length; i += 1) {
        if (document.data[i] === '\n') {
            newlines += 1;
            lastLineLength = 0;
        }
        else {
            lastLineLength += 1;
        }
    }
    return new Position(newlines, lastLineLength);
}
/**
 * Get the `Range` of a Regex match in a whole document
 * @param document The document on which the Regex was matched
 * @param regexResult The result of the Regex match
 * @param offset If the Regex was matched on a substring of the whole document, 
 * this is the offset of the substring the regex was matched on
 * @returns 
 */
function rangeFromRegex(document: MaybeDocument, regexResult: RegExpMatchArray, offset: number = 0): Range {
    return new Range(
        positionAtIndex(document, (regexResult.index ?? 0) + offset),
        positionAtIndex(document, (regexResult.index ?? 0) + offset + regexResult[0].length),
    );
}

const TYPE_LOOKUPS: Record<string, string> = {
    bool: "bool",
    int: "int64_t",
    float: "double",
    string: "std::string",
    file: "std::filesystem::path",
    folder: "std::filesystem::path",
    color: "cocos2d::ccColor3B",
    rgb: "cocos2d::ccColor3B",
    rgba: "cocos2d::ccColor4B"
};

let RESOURCE_FILE_EXTENSIONS: string[] = [];

function getResourcesFileExtensions(db: Database): string[] {
    const extFromPath = <T extends ItemType>(i: Item<T>) => parsePath(i.path).ext.slice(1);

    if (!RESOURCE_FILE_EXTENSIONS.length) {
        for (const collection of db.getCollections()) {
            RESOURCE_FILE_EXTENSIONS.push(
                ...new Set(collection.sheets.map(extFromPath))
            );
            RESOURCE_FILE_EXTENSIONS.push(
                ...new Set(collection.sprites.map(extFromPath))
            );
            RESOURCE_FILE_EXTENSIONS.push(
                ...new Set(collection.fonts.map(extFromPath))
            );
            RESOURCE_FILE_EXTENSIONS.push(
                ...new Set(collection.audio.map(extFromPath))
            );
        }
    }

    return RESOURCE_FILE_EXTENSIONS;
}

function lint(
    document: MaybeDocument,
    diagnostics: Diagnostic[],
    code: string,
    regex: RegExp,
    condition: (match: { text: string, groups: Record<string, string>, range: Range, offset: number }) => 
        { msg: string, level: DiagnosticSeverity, range: Range }[] | string | undefined,
) {
    const ignoreRanges: { from: number, to: number }[] = [];

    for (const match of document.data.matchAll(
        new RegExp(`(?:\\/\\/\\s*@geode-begin-ignore\\(${code}\\).*?$)(?:(?!\\/\\/\\s*@geode-end-ignore\\(${code}\\))(?:\\s|.))*|\\/\\*(?:(?!\\*\\/)(?:\\s|.))*`, "gm")
    )) {
        if (match.index !== undefined) {
            ignoreRanges.push({ from: match.index, to: match.index + match[0].length });
        }
    }

    // Look for matches for the regex
    for (const match of document.data.matchAll(new RegExp(
        `(?<ignore>\\/\\/\\s*@geode-ignore\\(${code}\\).*?$\\r?\\n^.*?|\\/\\/.*?)?${regex.source}`,
        regex.flags.includes("m") ? regex.flags : regex.flags + "m"
    ))) {
        if (match.index === undefined || match.groups?.ignore || ignoreRanges.some(range => range.from <= match.index! && range.to >= match.index!)) {
            continue;
        }

        const range = rangeFromRegex(document, match);
        let result = condition({ text: match[0], groups: match.groups ?? {}, range, offset: match.index });

        // For uniform handling convert the result to an array
        if (typeof result === "string") {
            result = [{
                msg: result,
                level: DiagnosticSeverity.Warning,
                range: range,
            }];
        }

        if (result) {
            for (const diag of result) {
                const diagnostic = new Diagnostic(diag.range, diag.msg, diag.level);
                diagnostic.code = code;
                diagnostic.source = "geode";
                diagnostics.push(diagnostic);
            }
        }
    }
}

function lintAlternative(document: MaybeDocument, diagnostics: Diagnostic[]) {
    lint(document, diagnostics, "geode-alternative", /std\s*::\s*cout/g, () => {
        return "Use the logging methods from the \"geode::log\" namespace instead of \"std::cout\"";
    });
}

function lintSettings(document: MaybeDocument, diagnostics: Diagnostic[]) {
    const settings = getProjectFromDocument(document.uri)?.modJson.settings;
    if (!settings) {
        return;
    }
    lint(
        document, diagnostics,
        "unknown-setting",
        /[gs]etSettingValue<\s*(?<type>[^>]+?)\s*>\s*\(\s*"(?<name>(?:[^"\\]|\\.)+?)\"\s*\)/g,
        ({ groups: { name, type } }) => {
            const setting = settings[name];
            const types = TYPE_LOOKUPS[setting.type]?.split("::").reverse();

            if (!setting) {
                return `Unknown setting ${name}`;
            } else if (setting.type === "title") {
                return "Titles can't be used as a setting value";
            } else if (!setting.type.startsWith("custom:") && !type.split("::").reverse().every((part, i) => part.trim() === types?.[i])) {
                return `Setting ${name} is of type ${setting.type}, not ${type}`;
            }

            return undefined;
        }
    );
}

// function lintOverrides(document: MaybeDocument, diagnostics: Diagnostic[]) {
//     const rootDir = workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
//     if (!rootDir) {
//         return;
//     }
//     try {
//         // todo: reload bindings at some point
//         if (!LOADED_BINDINGS) {
//             LOADED_BINDINGS = JSON.parse(readFileSync(`${rootDir}/build/bindings/bindings/Geode/CodegenData.json`).toString());
//         }
//         lint(
//             document, diagnostics,
//             "unknown-modify",
//             /(?<=\$modify\(\s*(?:\w+,\s*)?)\w+(?=\s*\))/g,
//             ({ text, range }) => {
//                 lint(
//                     document, diagnostics,
//                     "unknown-override",
//                     //
//                 );

//                 if (!LOADED_BINDINGS!.classes.find(p => p.name === text)) {
//                     return `Unknown modify class ${text}`;
//                 }
//                 return;
//             }
//         );
//     }
//     catch(e) {
//         getOutputChannel().appendLine(`Unable to load bindings: ${e}`);
//     }
// }

function lintUnknownResource(document: MaybeDocument, diagnostics: Diagnostic[], initialRun: boolean) {
    const modJson = getProjectFromDocument(document.uri)?.modJson;
    if (!modJson) {
        return;
    }
    
    const db = browser.getDatabase();
    const knownResourceExts = getResourcesFileExtensions(db);
    const dependencies = ["geode.loader"];

    // Reload DB on filesave (in case new resources have been added to fix the issues)
    if (!initialRun) {
        db.refresh();
    }

    if (modJson?.dependencies) {
        // TODO: Deprecate
        if (modJson.dependencies instanceof Array) {
            dependencies.push(...modJson.dependencies.map((d) => d.id));
        } else {
            dependencies.push(...Object.keys(modJson.dependencies));
        }
    }

    lint(
        document, diagnostics,
        "unknown-resource",
        /(?<method>expandSpriteName|[Ss]prite|[Ll]abel)(?<args>.*("[^"]+\.[^"]+"(_spr)?))+/gs,
        ({ groups: { method, args }, offset }) => {
            // Don't lint `expandSpriteName` because if someone is using it they 
            // should know what they are doing
            if (method === "expandSpriteName") {
                return undefined;
            }

            const results = [];

            // Extract any arguments that look like "sprite.png"
            for (const arg of args.matchAll(/"(?<name>[^"]+\.[^"]+)"(?<suffix>_spr)?/g)) {
                const { name, suffix } = arg.groups!;
                // `offset` is the offset of the lint regex, `method.length` is 
                // because we are matching only the `args` match
                const nameRange = rangeFromRegex(document, arg, offset + method.length);

                // Resource might have the same name as a GD resource, so first
                // try to find it in the mod's resources
                const item = db.getCollectionById(`mod:${modJson.id}`)?.findByName(name)
                    ?? db.findItemByName(name);

                {
                    // Avoid matching stuff that doesnt look like a resource
                    const parts = name.split(".");
                    if (parts.length < 2) {
                        continue;
                    }
                    const ext = parts[parts.length - 1].toLowerCase();
                    if (!knownResourceExts.includes(ext)) {
                        continue;
                    }

                    let shouldBreak = false;

                    // Avoid matching resources from dependencies
                    for (const dep of dependencies) {
                        if (name.startsWith(`${dep}/`)) {
                            shouldBreak = true;
                            break;
                        }
                    }

                    if (shouldBreak) {
                        continue;
                    }
                }

                if (!item) {
                    results.push({
                        level: DiagnosticSeverity.Warning,
                        msg: `Resource "${name}" doesn't exist`,
                        range: nameRange,
                    });
                }
                else {
                    if (!suffix && typeIsProject(item.src)) {
                        results.push({
                            level: DiagnosticSeverity.Warning,
                            msg: `Resource is missing _spr, perhaps you meant "${name}"_spr?`,
                            range: nameRange,
                        });
                    }
                    else if (suffix && !typeIsProject(item.src)) {
                        results.push({
                            level: DiagnosticSeverity.Warning,
                            msg: `Resource "${name}" was not found in mod.json`,
                            range: nameRange,
                        });
                    }
                }
            }
            return results;
        }
    );
}

function applyGeodeLints(document: MaybeDocument, diagnosticCollection: DiagnosticCollection, initialRun: boolean) {
    if (document.uri.toString().endsWith('.cpp') || document.uri.toString().endsWith('.hpp')) {
        const diagnostics: Diagnostic[] = [];
    
        // Add more linters here if needed
        lintAlternative(document, diagnostics);
        lintSettings(document, diagnostics);
        // lintOverrides(document, diagnostics);
        lintUnknownResource(document, diagnostics, initialRun);
    
        // Replace lints on the document
        diagnosticCollection.set(document.uri, diagnostics);
    }
}

class SuppressDiagnosticProvider implements CodeActionProvider {
    provideCodeActions(document: TextDocument, _1: Range | Selection, context: CodeActionContext, _2: CancellationToken): ProviderResult<(Command | CodeAction)[]> {
        const actions: CodeAction[] = [];
        context.diagnostics.forEach(diagnostic => {
            // Add a Quick Fix for dismissing Geode diagnostics
            if (diagnostic.source === "geode") {
                const action = new CodeAction('Suppress this warning', CodeActionKind.QuickFix);
                action.edit = new WorkspaceEdit();

                // Copy the same indentation so the diagnostic is on the same line
                let indent = document.getText(new Range(diagnostic.range.start.line, 0, diagnostic.range.end.line, 999));
                indent = indent.substring(0, indent.search(/[^\s]/));

                // Register the Quick Fix
                action.edit.insert(
                    document.uri,
                    new Position(diagnostic.range.start.line, 0),
                    `${indent}// @geode-ignore(${diagnostic.code})\n`
                );
                action.diagnostics = [diagnostic];
                actions.push(action);
            }
        });
        return actions;
    }
}

export function registerLinters(context: ExtensionContext) {
	const geodeDiagnostics = languages.createDiagnosticCollection("geode");
	context.subscriptions.push(geodeDiagnostics);

    // Relint on change
    context.subscriptions.push(workspace.onDidChangeTextDocument(ev => {
        applyGeodeLints({ uri: ev.document.uri, data: ev.document.getText() }, geodeDiagnostics, false);
    }));

    // This is for adding Quick Fixes for those diagnostics
    // Idk why we need to register a whole new provider just to add Quick Fixes 
    // to already provided lints...
    context.subscriptions.push(languages.registerCodeActionsProvider('cpp', new SuppressDiagnosticProvider()));

    // Lint all files on startup (so errors in unopened files get alerted too)
    // Skip build/ folder for obvious performance reasons
    workspace.findFiles('**/*.{cpp,hpp}', 'build*/**').then(docs => {
        docs.forEach(uri => readFile(uri.fsPath).then(data => {
            applyGeodeLints({ uri, data: data.toString() }, geodeDiagnostics, true);
        }));
    });
}
