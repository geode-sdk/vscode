import { CancellationToken, CodeAction, CodeActionContext, CodeActionKind, CodeActionProvider, Command, Diagnostic, DiagnosticCollection, DiagnosticSeverity, ExtensionContext, languages, Position, ProviderResult, Range, Selection, TextDocument, Uri, workspace, WorkspaceEdit } from "vscode";
import { getProjectFromDocument } from "./project";
import { getOutputChannel } from "../config";
import { readFile } from "fs/promises";
import { readFileSync } from "fs";

type Binding = "inline" | "link" | number | null;
type Bindings = {
    classes: {
        name: string,
        functions: {
            name: string,
            args: { type: string, name: string }[],
            const: boolean,
            virtual: boolean,
            static: boolean,
            bindings: {
                win: Binding,
                imac: Binding,
                m1: Binding,
                ios: Binding,
                android32: Binding,
                android64: Binding,
            }
        }[],
    }[]
};

let LOADED_BINDINGS: Bindings | undefined = undefined;

interface MaybeDocument {
    uri: Uri,
    data: string,
}

function lint(
    document: MaybeDocument,
    diagnostics: Diagnostic[],
    code: string,
    regex: RegExp,
    condition: (match: { text: string, range: Range }) => string | undefined,
    startLine: number = 0,
    endLine?: number,
) {
	const lines = document.data.split("\n");

    let ignoring: "next" | "until-end" | undefined;
	for (let line = startLine; line < lines.length; line++) {
        if (endLine && line > endLine) {
            break;
        }

        const lineData = lines[line];

        // Allow ignoring lints via comments
        if (lineData.includes(`geode-ignore-${code}`) || lineData.includes("geode-ignore-all")) {
            ignoring = "next";
            continue;
        }
        else if (lineData.includes(`geode-begin-ignore-${code}`) || lineData.includes("geode-begin-ignore-all")) {
            ignoring = "until-end";
            continue;
        }
        else if (lineData.includes(`geode-end-ignore-${code}`) || lineData.includes("geode-end-ignore-all")) {
            ignoring = undefined;
        }
        // Skip if we're ignoring stuff
        else if (ignoring !== undefined) {
            if (ignoring === "next") {
                ignoring = undefined;
            }
            continue;
        }

        // Look for matches for the regex
		for (const match of lineData.matchAll(regex)) {
			if (!match.index) {
				continue;
			}
            const range = new Range(
                new Position(line, match.index),
                new Position(line, match.index + match[0].length),
            );
            const msg = condition({ text: match[0], range });
            if (msg !== undefined) {
                const diagnostic = new Diagnostic(range, msg, DiagnosticSeverity.Warning);
                diagnostic.code = code;
                diagnostic.source = "geode";
                diagnostics.push(diagnostic);
            }
		}
	}
}

function lintSettings(document: MaybeDocument, diagnostics: Diagnostic[]) {
    const project = getProjectFromDocument(document.uri);
    if (!project || !project.modJson.settings) {
        return;
    }
    lint(
        document, diagnostics,
        "unknown-setting",
        /(?<=[gs]etSettingValue.*?\(\s*")[a-z0-9\-]+(?="[^\)]*\))/g,
        ({ text }) => {
            if (!(text in project.modJson.settings!)) {
                return `Unknown setting ${text}`;
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

function applyGeodeLints(document: MaybeDocument, diagnosticCollection: DiagnosticCollection) {
    if (document.uri.toString().endsWith('.cpp') || document.uri.toString().endsWith('.hpp')) {
        const diagnostics: Diagnostic[] = [];
    
        // Add more linters here if needed
        lintSettings(document, diagnostics);
        // lintOverrides(document, diagnostics);
    
        // Replace lints on the document
        diagnosticCollection.set(document.uri, diagnostics);
    }
}

class SuppressDiagnosticProvider implements CodeActionProvider {
    provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken): ProviderResult<(Command | CodeAction)[]> {
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
                    `${indent}// geode-ignore-${diagnostic.code}\n`
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
