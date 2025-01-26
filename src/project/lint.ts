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
    condition: (match: { text: string, groups: Record<string, string> | undefined, range: Range }) => { msg: string, level: DiagnosticSeverity } | string | undefined,
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

        const priorLines = document.data.substring(0, match.index).split("\n");
        const range = new Range(
            new Position(priorLines.length - 1, priorLines.at(-1)!.length),
            new Position(priorLines.length + match[0].split("\n").length - 2, match.index + match[0].length),
        );
        const result = condition({ text: match[0], groups: match.groups, range });

        if (result !== undefined) {
            const isString = typeof result === "string";
            const diagnostic = new Diagnostic(range, isString ? result : result.msg, isString ? DiagnosticSeverity.Warning : result.level);
            diagnostic.code = code;
            diagnostic.source = "geode";
            diagnostics.push(diagnostic);
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
        ({ groups }) => {
            const setting = settings[groups!.name];
            const types = TYPE_LOOKUPS[setting.type]?.split("::").reverse();

            if (!setting) {
                return `Unknown setting ${groups!.name}`;
            } else if (setting.type === "title") {
                return "Titles can't be used as a setting value";
            } else if (!setting.type.startsWith("custom:") && !groups!.type.split("::").reverse().every((part, i) => part.trim() === types?.[i])) {
                return `Setting ${groups!.name} is of type ${setting.type}, not ${groups!.type}`;
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
//                 return undefined;
//             }
//         );
//     }
//     catch(e) {
//         getOutputChannel().appendLine(`Unable to load bindings: ${e}`);
//     }
// }

function lintUnknownResource(document: MaybeDocument, diagnostics: Diagnostic[]) {
    const modJson = getProjectFromDocument(document.uri)?.modJson;
    if (!modJson) {
        return;
    }
    
    const db = browser.getDatabase();
    const dependencies = ["geode.loader"];

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
        /(?<method>\S+)?\(\s*(?<args>(?:(?:"|')[^"']*(?:"|')(?:_spr)?\s*,?\s*)+)\s*\)/g,
        ({ groups }) => {
            if (
                groups!.method.startsWith("web::") || 
                groups!.method.includes("expandSpriteName")
            ) {
                return undefined;
            }

            const args = groups!.args
                // remove indentation
                .replace(/("|'),\s*/g, "$1, ")
                // match only functions with parameters of strings
                .matchAll(/(?:(((?:"|')\S+\.\S+(?:"|'))(_spr)?)+?)(?:,\s*|\))?/g);

            for (const arg of args) {
                const hasSpr = arg[3] === "_spr" || groups!.method.endsWith("spr");
                const resourceName = arg[2]!.replace(/'|"/g, "");
                // resourceName might have the same name as a gd resource, so first
                // try to find it in the mod's resources
                const item = db.getCollectionById(`mod:${modJson.id}`)?.findByName(resourceName)
                    ?? db.findItemByName(resourceName);

                {
                    // avoid matching stuff that doesnt look like a resource
                    if (!resourceName.match(
                        new RegExp(`^\\S+\\.(${getResourcesFileExtensions(db).join('|')})$`, "i")
                    )) {
                        continue;
                    }

                    let shouldBreak = false;

                    // avoid matching resources from dependencies
                    for (const dep of dependencies) {
                        if (resourceName.startsWith(`${dep}/`)) {
                            shouldBreak = true;
                            break;
                        }
                    }

                    if (shouldBreak) {
                        continue;
                    }
                }

                if (!item) {
                    return {
                        level: DiagnosticSeverity.Warning,
                        msg: `Resource "${resourceName}" doesn't exist`
                    };
                }

                if (!hasSpr && typeIsProject(item.src)) {
                    return {
                        level: DiagnosticSeverity.Warning,
                        msg: `Resource is missing _spr, perhaps you meant "${resourceName}"_spr?`
                    };
                }

                if (hasSpr && !typeIsProject(item.src)) {
                    return {
                        level: DiagnosticSeverity.Warning,
                        msg: `Resource "${resourceName}" was not found in mod.json`
                    };
                }
            }

            return undefined;
        }
    );
}

function applyGeodeLints(document: MaybeDocument, diagnosticCollection: DiagnosticCollection) {
    if (document.uri.toString().endsWith('.cpp') || document.uri.toString().endsWith('.hpp')) {
        const diagnostics: Diagnostic[] = [];
    
        // Add more linters here if needed
        lintAlternative(document, diagnostics);
        lintSettings(document, diagnostics);
        // lintOverrides(document, diagnostics);
        lintUnknownResource(document, diagnostics);
    
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
        applyGeodeLints({ uri: ev.document.uri, data: ev.document.getText() }, geodeDiagnostics);
    }));

    // This is for adding Quick Fixes for those diagnostics
    // Idk why we need to register a whole new provider just to add Quick Fixes 
    // to already provided lints...
    context.subscriptions.push(languages.registerCodeActionsProvider('cpp', new SuppressDiagnosticProvider()));

    // Lint all files on startup (so errors in unopened files get alerted too)
    // Skip build/ folder for obvious performance reasons
    workspace.findFiles('**/*.{cpp,hpp}', 'build*/**').then(docs => {
        docs.forEach(uri => readFile(uri.fsPath).then(data => {
            applyGeodeLints({ uri, data: data.toString() }, geodeDiagnostics);
        }));
    });
}
