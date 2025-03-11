import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { TextDocument, TextEditor, Uri, window, workspace } from "vscode";
import { None, Option, Some } from "../utils/monads";
import { ModJson } from "./ModJson";
import { getOutputChannel } from "../config";

// todo: it would be nice if projects were static and only parsed mod.json again 
// when the file changed

export class Project {
	#path: string;
	#modJson: ModJson;

	private constructor(path: string) {
		this.#path = path;
		this.#modJson = JSON.parse(readFileSync(join(path, "mod.json")).toString());
	}

	public static from(path: string): Option<Project> {
		// Detect Geode loader itself which has mod.json in `loader/resources`
		if (existsSync(join(path, "loader/resources/mod.json"))) {
			return new Project(join(path, "loader/resources"));
		}
		if (existsSync(join(path, "mod.json"))) {
			return new Project(path);
		}
		return None;
	}
	
	/**
	 * Get the currently active project. If there are multiple mods open in the 
	 * same workspace, will pick the one which has a focused text editor at the 
	 * moment
	 */
	public static active(): Option<Project> {
		if (!workspace.workspaceFolders?.length) {
			return None;
		}
		if (window.activeTextEditor) {
			return Project.forDocument(window.activeTextEditor.document.uri);
		} else {
			if (workspace.workspaceFolders.length === 1) {
				return Project.from(workspace.workspaceFolders[0].uri.fsPath);
			}
		}
		return None;
	}
	/** 
	 * Get all currently open projects in VSCode
	 */
	public static getOpened(): Project[] {
		if (!workspace.workspaceFolders?.length) {
			return [];
		}
		const projects: Project[] = [];
		for (const folder of workspace.workspaceFolders) {
			const project = Project.from(folder.uri.fsPath);
			if (project) {
				projects.push(project);
			}
		}
		return projects;
	}
	public static forDocument(uri: Uri): Option<Project> {
		const w = workspace.getWorkspaceFolder(uri);
		if (w) {
			return Project.from(w.uri.fsPath);
		}
		return undefined;
	}

	public isActive(): boolean {
		return this.#modJson.id === Project.active()?.getModJson().id;
	}
	public getPath(): string {
		return this.#path;
	}
	public getModJson(): ModJson {
		return this.#modJson;
	}
	public hasResources(): boolean {
		return this.#modJson.resources !== undefined;
	}
}
