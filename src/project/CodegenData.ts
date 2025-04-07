import { existsSync, readFileSync } from "node:fs";
import { None, Option } from "../utils/monads";
import { Project, ProjectDatabase } from "./Project";
import { join } from "node:path";
import { workspace } from "vscode";

export interface CodegenData {
	classes: CodegenClass[];
}

export interface CodegenClass {
	name: string;
	functions: CodegenFunction[];
}

type CodegenBindingType = number | "link" | "inline" | null;

export interface CodegenFunction {
	name: string;
	args: CodegenArg[];
	static: boolean;
	const: boolean;
	virtual: boolean;
	bindings: {
		win: CodegenBindingType;
		imac: CodegenBindingType;
		m1: CodegenBindingType;
		ios: CodegenBindingType;
		android32: CodegenBindingType;
		android64: CodegenBindingType;
	};
	return: string;
	docs?: string;
	kind: string;
}

export interface CodegenArg {
	type: string;
	name: string;
}

let CACHED_CODEGEN_DATA: Option<CodegenData> = None;

export function getActiveCodegenData(): Option<CodegenData> {
	if (CACHED_CODEGEN_DATA) {
		return CACHED_CODEGEN_DATA;
	}

	const project = ProjectDatabase.get().getActive();
	if (!project) {
		return None;
	}

	const jsonRelativePath = "bindings/bindings/Geode/CodegenData.json";
	const codegenDataPath = [
		`${project.getPath()}/build`,
		`${project.getPath()}/build-android64`,
		`${project.getPath()}/build-android32`,
		`${project.getPath()}/build-win`,
		`${project.getPath()}/build-mac`,
		workspace.workspaceFolders?.length === 1
			? `${workspace.workspaceFolders![0].uri.fsPath}/build`
			: undefined,
	]
		.filter((x) => x)
		.map((buildDir) => join(buildDir!, jsonRelativePath))
		.find((path) => existsSync(path));
	if (!codegenDataPath) {
		return None;
	}

	return (CACHED_CODEGEN_DATA = JSON.parse(
		readFileSync(codegenDataPath).toString(),
	));
}
