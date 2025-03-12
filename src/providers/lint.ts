import {
    CancellationToken,
    CodeAction,
    CodeActionContext,
    CodeActionKind,
    CodeActionProvider,
    Command,
    Diagnostic,
    DiagnosticCollection,
    DiagnosticSeverity,
    ExtensionContext,
    languages,
    Position,
    ProviderResult,
    Range,
    Selection,
    TextDocument,
    Uri,
    workspace,
    WorkspaceEdit,
} from "vscode";
import { readFile } from "fs/promises";
import { parse as parsePath } from "path";
import { getExtConfig } from "../config";
import { ResourceDatabase } from "../project/resources/ResourceDatabase";
import { Project } from "../project/Project";
import { RESOURCE_NAME_MATCH_REGEX, sourceID, sourceIDForModID } from "../project/resources/Resource";
import { None } from "../utils/monads";

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

function lint(
    document: MaybeDocument,
    diagnostics: Diagnostic[],
    code: string,
    regex: RegExp,
    condition: (match: { text: string, groups: Record<string, string | undefined>, range: Range, offset: number }) => 
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
        `${/((\/\/\s*@geode-ignore\((?<ignoreTags>[^\)]*)\).*?$\r?\n^.*?)|(\/\/.*?))?/.source}${regex.source}`,
        regex.flags.includes("m") ? regex.flags : regex.flags + "m"
    ))) {
        if (
            match.index === undefined || match.groups?.ignoreTags?.includes(code) ||
            ignoreRanges.some(range => range.from <= match.index! && range.to >= match.index!)
        ) {
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
    const settings = Project.forDocument(document.uri)?.getModJson().settings;
    if (!settings) {
        return;
    }
    lint(
        document, diagnostics,
        "unknown-setting",
        /[gs]etSettingValue<\s*(?<type>[^>]+?)\s*>\s*\(\s*"(?<name>(?:[^"\\]|\\.)+?)\"\s*\)/g,
        ({ groups: { name, type } }) => {
            name = name!;
            type = type!;
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
    const mod = Project.forDocument(document.uri);
    if (!mod) {
        return;
    }

    const modJson = mod.getModJson();
    const db = ResourceDatabase.get();
    const dependencies = ["geode.loader"];

    // Reload DB on filesave (in case new resources have been added to fix the issues)
    if (!initialRun) {
        db.getCollectionForModID(modJson.id)?.reload();
    }

    if (modJson.dependencies) {
        // TODO: Deprecate
        if (modJson.dependencies instanceof Array) {
            dependencies.push(...modJson.dependencies.map((d) => d.id));
        }
        else {
            dependencies.push(...Object.keys(modJson.dependencies));
        }
    }

    lint(
        document, diagnostics,
        "unknown-resource",
        // Match resource-name-looking strings ("x.png", "thing.fnt" etc.)
        // todo: this method doesn't actually match mistakes like "thing" where you forget the file extension
        RESOURCE_NAME_MATCH_REGEX,
        ({ groups: { modID, name, suffix }, range }) => {
            const resource = ResourceDatabase.get().tryFindResourceFromUse(document.uri, modID, name!, suffix !== undefined);
            if (!resource) {
                if (modID && db.getCollectionForModID(modID) === undefined) {
                    return [{
                        level: DiagnosticSeverity.Warning,
                        msg: `Unknown mod '${modID}'`,
                        range,
                    }];
                }
                return [{
                    level: DiagnosticSeverity.Warning,
                    msg: `Resource "${name}" doesn't exist${modID ? ` in mod '${modID}'` : ""}`,
                    range,
                }];
            }
            else if (!modID) {
                if (!suffix && resource.getSource() instanceof Project) {
                    return [{
                        level: DiagnosticSeverity.Warning,
                        msg: `Resource is missing _spr, perhaps you meant "${name}"_spr?`,
                        range,
                    }];
                }
                else if (suffix && !(resource.getSource() instanceof Project)) {
                    return [{
                        level: DiagnosticSeverity.Warning,
                        msg: `Resource "${name}" was not found in mod.json`,
                        range,
                    }];
                }
            }

            return undefined;
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
        if (getExtConfig().get<boolean>("lints.enable")) {
            applyGeodeLints({ uri: ev.document.uri, data: ev.document.getText() }, geodeDiagnostics, false);
        }
        // If lints aren't enabled, reset diagnostics to remove existing ones
        else {
            geodeDiagnostics.set(ev.document.uri, []);
        }
    }));

    // This is for adding Quick Fixes for those diagnostics
    // Idk why we need to register a whole new provider just to add Quick Fixes 
    // to already provided lints...
    context.subscriptions.push(languages.registerCodeActionsProvider('cpp', new SuppressDiagnosticProvider()));

    // Skip this step if lints are disabled
    // We don't want to just skip the whole `registerLinters` function if the 
    // setting is disabled because then users would be required to restart 
    // VSCode to refresh the setting's value
    if (getExtConfig().get<boolean>("lints.enable")) {
        // Lint all files on startup (so errors in unopened files get alerted too)
        // Skip build/ folder for obvious performance reasons
        workspace.findFiles('**/*.{cpp,hpp}', 'build*/**').then(docs => {
            docs.forEach(uri => readFile(uri.fsPath).then(data => {
                applyGeodeLints({ uri, data: data.toString() }, geodeDiagnostics, true);
            }));
        });
    }
}
