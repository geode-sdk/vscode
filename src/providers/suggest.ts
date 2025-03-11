import {
	CancellationToken,
	CompletionContext,
	CompletionItem,
	CompletionItemKind,
	CompletionItemProvider,
	CompletionItemTag,
	Position,
	SnippetString,
	TextDocument,
} from "vscode";
import { getActiveCodegenData } from "../project/CodegenData";
import { getExtConfig } from "../config";

const MODIFY_CLASS_REGEX =
	/^(?:class|struct)(?: \$modify\((?:\w+,)?\s?(\w+)\)|.+Modify\<(\w+)\>)/;

export class ModifyClassMethodCompletion implements CompletionItemProvider {
	provideCompletionItems(
		document: TextDocument,
		position: Position,
		_token: CancellationToken,
		_context: CompletionContext,
	) {
		if (!getExtConfig().get<boolean>("modifyClassSuggestions.enable")) {
			return;
		}

		// try to find what modify class we're on
		// not a great system but works for now
		let currentClass = null;
		let lineN = position.line;
		while (lineN >= 0) {
			let line = document.lineAt(lineN).text;
			if (line.startsWith("};")) {
				break;
			}
			let match = line.match(MODIFY_CLASS_REGEX);
			if (match) {
				currentClass = match[1] ?? match[2];
				break;
			}
			--lineN;
		}
		if (!currentClass) {
			return;
		}

		const codegenData = getActiveCodegenData();
		if (!codegenData) {
			return;
		}

		let classInfo = null;
		for (let c of codegenData.classes) {
			if (c.name === currentClass) {
				classInfo = c;
				break;
			}
		}
		if (!classInfo) {
			return;
		}

		const stripCocos = getExtConfig().get<boolean>(
			"modifyClassSuggestions.stripCocosNamespace",
		);
		const addOverrideMacro = getExtConfig().get<boolean>(
			"modifyClassSuggestions.addOverrideMacro",
		);

		let suggestions = [];
		for (let func of classInfo.functions) {
			const shortFuncDecl = `${func.name}(${func.args.map((a) => `${a.type} ${a.name}`).join(", ")})`;
			const fullFuncDecl =
				`${func.static ? "static " : ""}${func.return} ${shortFuncDecl}`.trimStart();
			const origCall = `${currentClass}::${func.name}(${func.args.map((a) => a.name).join(", ")})`;

			let origStatement;
			if (func.return === "void") {
				origStatement = `\${1}\n\t${origCall};`;
			} else if (func.return === "bool") {
				origStatement = `if (!${origCall}) return false;\n\t\${1}\n\treturn true;`;
			} else if (func.kind !== "normal") {
				origStatement = `${origCall};\n\t\${1}`;
			} else {
				origStatement = `${func.return} ret = ${origCall};\n\t\${1}\n\treturn ret;`;
			}

			const item = new CompletionItem(
				shortFuncDecl,
				CompletionItemKind.Method,
			);

			item.insertText = `${fullFuncDecl} {\n\t${origStatement}\n}`;
			if (func.kind === "ctor" || func.kind === "dtor") {
				item.insertText = `void ${func.kind === "ctor" ? "constructor" : "destructor"}() {\n\t${origStatement}\n}`;
			}
			if (addOverrideMacro) {
				item.insertText = `\\$override\n${item.insertText}`;
			}
			if (stripCocos) {
				item.insertText = item.insertText.replace(/cocos2d::/g, "");
			}
			item.insertText = new SnippetString(item.insertText);

			let rank = 0;
			item.detail = fullFuncDecl;
			item.documentation = "";

			if (func.docs) {
				item.documentation = func.docs.trim();
			}
			if (func.return === "TodoReturn") {
				item.tags = [CompletionItemTag.Deprecated];
				item.documentation = "Missing return type, do not use";
				item.insertText = `// TODO: fix TodoReturn\n// ${fullFuncDecl}`;
				rank = 1;
				item.sortText = "1" + shortFuncDecl;
			}
			if (Object.values(func.bindings).includes("inline")) {
				item.tags = [CompletionItemTag.Deprecated];
				if (Object.values(func.bindings).every((b) => b === "inline")) {
					item.documentation += "\nInline method, cannot hook";
					item.insertText = `// ${shortFuncDecl} is inlined on all platforms, cannot hook`;
					rank = 1;
				} else {
					item.documentation += "\nInline method on some platforms";
				}
			}

			item.sortText = rank.toString() + shortFuncDecl;
			suggestions.push(item);
		}
		return suggestions;
	}
}
