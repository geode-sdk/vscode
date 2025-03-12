import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { ExtensionContext, TextDocument, TextEditor, Uri, window, workspace } from "vscode";
import { Future, None, Ok, Option, Result, Some } from "../utils/monads";
import { ModJson } from "./ModJson";
import { getOutputChannel } from "../config";
import { removeFromArray } from "../utils/general";
import { ResourceDatabase } from "./resources/ResourceDatabase";
import { GeodeSDK } from "./GeodeSDK";

// todo: detect if mod.json changes and if so reload project

export class Project {
	#path: string;
	#modJson: ModJson;
	#dependencyOf: Option<Project>;
	#dependencies: Project[] = [];

	constructor(path: string, dependencyOf: Option<Project>) {
		this.#path = path;
		this.#modJson = JSON.parse(readFileSync(join(path, "mod.json")).toString());
		this.#dependencyOf = dependencyOf;
	}
	addDependency(dependency: Project) {
		this.#dependencies.push(dependency);
	}
	removeDependency(dependency: Project) {
		removeFromArray(this.#dependencies, dependency);
	}

	public isActive(): boolean {
		return this.#modJson.id === ProjectDatabase.get().getActive()?.getModJson().id;
	}
	public getPath(): string {
		return this.#path;
	}
	public getModJson(): ModJson {
		return this.#modJson;
	}
	public getDependencyOf(): Option<Project> {
		return this.#dependencyOf;
	}
	public getDependencies(): Project[] {
		return this.#dependencies;
	}
	public hasResources(): boolean {
		return this.#modJson.resources !== undefined;
	}
}

export class ProjectDatabase {
	#projects: Project[];
	// todo: some sort of events system so we don't have to do these hooks manually
	#onProjectsChangeHooks: (() => void)[] = [];
	static #instance: ProjectDatabase = new ProjectDatabase();

	private constructor() {
		this.#projects = [];
	}

	static get(): ProjectDatabase {
		return this.#instance;
	}

	private async reloadProjects() {
		getOutputChannel().appendLine("Reloading projects...");
		this.#projects = [];
		// Load loader project
		GeodeSDK.get()?.getLoaderProject();
		// Load any open projects
		for (const folder of workspace.workspaceFolders ?? []) {
			this.loadProject(folder.uri.fsPath);
		}
		// If no projects were loaded, we need to run the hooks, otherwise the 
		// last loadProject() call will have done it for us
		// God we need some sort of event/message system this could all be 
		// handled automatically with that
		if (this.#projects.length === 0) {
			for (const hook of this.#onProjectsChangeHooks) {
				hook();
			}
		}
		getOutputChannel().appendLine(
			`Found projects: ${
				ProjectDatabase.get().getOpened()
					.map(p => `${p.getModJson().name} (${p.getModJson().id}, ${p.getDependencies().length} dependencies)`)
					.join(", ")
			}`,
		);
	}
	onProjectsChange(hook: () => void) {
		this.#onProjectsChangeHooks.push(hook);
	}
	async setup(context: ExtensionContext): Future {
		context.subscriptions.push(
			workspace.onDidChangeWorkspaceFolders(e => this.reloadProjects())
		);
		// todo: this is kind of a bad way to check for mod.json changes but it 
		// gets the job done ig
		// a better way would be to check if the mod.json contents are newer in 
		// Project.getModJson() although it might be bad to have that method do 
		// a filesystem check every call
		context.subscriptions.push(
			workspace.onDidSaveTextDocument(e => {
				if (e.fileName === "mod.json") {
					this.reloadProjects();
				}
			})
		);
		await this.reloadProjects();
		return Ok();
	}

	private loadProjectReal(path: string, dependencyOf: Option<Project>): Option<Project> {
		try {
			const project = new Project(path, dependencyOf);
			this.#projects.push(project);

			// Load dependencies (if this is not a dependency itself)
			if (dependencyOf === None) {
				const depsDir = join(path, "build/geode-deps");
				try {
					for (const dep of readdirSync(depsDir, { withFileTypes: true })) {
						if (dep.isDirectory()) {
							const depPro = this.loadProjectReal(join(depsDir, dep.name), project);
							if (depPro) {
								project.addDependency(depPro);
							}
						}
					}
				}
				catch (_) {}

				// Only run the hooks once after all dependencies are loaded
				for (const hook of this.#onProjectsChangeHooks) {
					hook();
				}
			}
			return project;
		}
		// We don't really care about errors, if this function was called on a 
		// invalid directory then just move on and say the project couldn't be 
		// opened
		catch (e) {
			return None;
		}
	}
	loadProject(path: string): Option<Project> {
		// Detect Geode loader itself which has mod.json in `loader/resources`
		for (const dir of ["./loader/resources", "."]) {
			const dirPath = join(path, dir);
			// Check if this project is already loaded
			const existing = this.#projects.find(p => p.getPath() === dirPath);
			if (existing !== None) {
				return existing;
			}
			// Otherwise check if it looks like a real mod, if so load it
			if (existsSync(join(dirPath, "mod.json"))) {
				return this.loadProjectReal(dirPath, None);
			}
		}
		return None;
	}
	loadProjectOfDocument(uri: Uri): Option<Project> {
		const w = workspace.getWorkspaceFolder(uri);
		if (w) {
			return this.loadProject(w.uri.fsPath);
		}
		return None;
	}

	/**
	 * Get the currently active project. If there are multiple mods open in the 
	 * same workspace, will pick the one which has a focused text editor at the 
	 * moment
	 */
	getActive(): Option<Project> {
		if (!workspace.workspaceFolders?.length) {
			return None;
		}
		// If there is a text editor in focus, then return the project for that 
		if (window.activeTextEditor) {
			return this.loadProjectOfDocument(window.activeTextEditor.document.uri);
		}
		// Otherwise if there is only one folder open in the workspace then 
		// that's the only project that could be open
		else if (workspace.workspaceFolders.length === 1) {
			return this.loadProject(workspace.workspaceFolders[0].uri.fsPath);
		}
		return None;
	}
	/**
	 * Get all loaded projects, including dependencies of existing projects
	 */
	getAll(): Project[] {
		return this.#projects;
	}
	/** 
	 * Get all currently open projects in VSCode
	 */
	getOpened(): Project[] {
		return this.#projects.filter(
			p => workspace.workspaceFolders?.some(f => f.uri.fsPath === p.getPath())
		);
	}
}
