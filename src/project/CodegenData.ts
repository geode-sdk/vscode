import { existsSync, readFileSync } from "node:fs";
import { None, Option } from "../utils/monads";
import { getActiveProject } from "./project";

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

	const project = getActiveProject();
	if (!project) {
		return None;
	}

	const codegenDataPath = `${project.path}/build/bindings/bindings/Geode/CodegenData.json`;
	if (!existsSync(codegenDataPath)) {
		return None;
	}

	return (CACHED_CODEGEN_DATA = JSON.parse(
		readFileSync(codegenDataPath).toString(),
	));
}
