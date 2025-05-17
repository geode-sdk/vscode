import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { ExtensionContext, Uri, window, workspace } from "vscode";
import { Future, None, Ok, Option } from "../utils/monads";
import { getDependencies, ModJson } from "./ModJson";
import { getOutputChannel } from "../config";
import { removeFromArray } from "../utils/general";
import { GeodeSDK } from "./GeodeSDK";
 
// todo: detect if mod.json changes and if so reload project

export class Project {
	#workspacePath: Option<string>;
	#path: string;
	#modJson: ModJson;
	#dependencyOf: Project[] = [];
	#dependencies: Project[] = [];

	constructor(workspacePath: Option<string>, path: string) {
		this.#workspacePath = workspacePath;
		this.#path = path;

		// This will be overwrittenby the reload function immediately
		this.#modJson = undefined as never;
		this.reloadModJSON();
	}
	makeDependencyFor(parent: Project) {
		if (!parent.#dependencies.includes(this)) {
			parent.#dependencies.push(this);
			this.#dependencyOf.push(parent);
		}
	}
	removeDependency(parent: Project) {
		removeFromArray(parent.#dependencies, this);
		removeFromArray(this.#dependencyOf, parent);
	}
	reloadModJSON() {
		this.#modJson = JSON.parse(readFileSync(join(this.#path, "mod.json")).toString());
	}

	public isActive(): boolean {
		return this.#modJson.id === ProjectDatabase.get().getActive()?.getModJson().id;
	}
	public getWorkspacePath(): Option<string> {
		return this.#workspacePath;
	}
	public getPath(): string {
		return this.#path;
	}
	public getModJson(): ModJson {
		return this.#modJson;
	}
	public getDependencyOf(): Project[] {
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
	#onProjectsChangeHooks: ((modID: Option<Project>) => any)[] = [];
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

		// Collect potential project paths (SDK path + open workspace folders)
		const projectPaths: [string, string][] = [];
		const sdkPath = GeodeSDK.get()?.getPath();
		if (sdkPath) {
			projectPaths.push([sdkPath, join(sdkPath, "loader/resources")]);
		}
		for (const folder of workspace.workspaceFolders ?? []) {
			const path = folder.uri.fsPath;
			if (path !== sdkPath && existsSync(join(path, "mod.json"))) {
				projectPaths.push([path, path]);
			}
		}

		// Load workspace projects
		for (const [workspacePath, path] of projectPaths) {
			// Something here might fail (such as the project directory not 
			// having a valid mod.json)
			try {
				this.#projects.push(new Project(workspacePath, path));
			}
			catch (e) {}
		}

		// Load dependencies for all the workspace projects
		for (const project of this.#projects) {
			// Note: This does parse mod.json again despite us just having done 
			// that a moment ago
			this.updateProject(project, false);
		}

		// Notify listeners that all projects have been reloaded
		for (const hook of this.#onProjectsChangeHooks) {
			hook(None);
		}

		getOutputChannel().appendLine(
			`Found projects: ${
				ProjectDatabase.get().getOpened()
					.map(p => `${p.getModJson().name} (${p.getModJson().id}, ${p.getDependencies().length} dependencies)`)
					.join(", ")
			}`,
		);
	}
	private async updateProject(project: Project, runHooks: boolean) {
		// Start by reloading mod.json since it defines information for the rest 
		// of the steps
		project.reloadModJSON();

		// Reload dependencies
		for (const id of Object.keys(getDependencies(project.getModJson()))) {
			// Don't let exceptions prevent us from loading the rest of the 
			// dependencies
			try {
				const existing = this.getByID(id);
				// If this dependency has already been loaded, just use the 
				// existing instance
				if (existing) {
					existing.makeDependencyFor(project);
					continue;
				}
				// Check that the dependency exists in the project's unzipped 
				// dependencies that have been loaded by CLI
				// SAFETY: We know `project.getWorkspacePath()` returns a 
				// defined value because we have just created the entire 
				// `this.#projects` array we are iterating before in this 
				// function
				const depPath = join(project.getWorkspacePath()!, "build/geode-deps", id);

				if (!existsSync(join(depPath, "mod.json"))) {
					continue;
				}

				// Create the dependency
				new Project(None, depPath).makeDependencyFor(project);
			} catch (_) {}
		}

		// Run hooks for this mod
		if (runHooks) {
			for (const hook of this.#onProjectsChangeHooks) {
				await hook(project);
			}
		}
	}
	onProjectsChange(hook: (modID: Option<Project>) => any) {
		this.#onProjectsChangeHooks.push(hook);
	}
	async setup(context: ExtensionContext): Future {
		context.subscriptions.push(
			workspace.onDidChangeWorkspaceFolders(() => this.reloadProjects())
		);
		// todo: this is kind of a bad way to check for mod.json changes but it 
		// gets the job done ig
		// a better way would be to check if the mod.json contents are newer in 
		// Project.getModJson() although it might be bad to have that method do 
		// a filesystem check every call
		context.subscriptions.push(
			workspace.onDidSaveTextDocument(async e => {
				if (e.fileName === "mod.json") {
					try {
						const project = this.getByID(JSON.parse(e.getText())["id"]);
						if (project) {
							await this.updateProject(project, true);
						}
					}
					catch (e) {}
				}
			})
		);
		await this.reloadProjects();
		return Ok();
	}

	/**
	 * Get the currently active project. If there are multiple mods open in the 
	 * same workspace, will pick the one which has a focused text editor at the 
	 * moment
	 */
	getActive(): Option<Project> {
		// If there is a text editor in focus, then return the project for that 
		if (window.activeTextEditor) {
			return this.#projects.find((project) => window.activeTextEditor!.document.uri.fsPath.startsWith(project.getWorkspacePath()!));
		}
		// Otherwise if there is only one folder open in the workspace then 
		// that's the only project that could be open
		if (workspace.workspaceFolders?.length === 1) {
			return this.#projects.find(p => p.getWorkspacePath() === workspace.workspaceFolders![0].uri.fsPath);
		}
		return None;
	}
	/**
	 * Get all loaded projects, including dependencies of existing projects
	 */
	getAll(): Project[] {
		return this.#projects.flatMap(p => [p, ...p.getDependencies()]);
	}
	/** 
	 * Get all currently open projects in VSCode
	 */
	getOpened(): Project[] {
		return this.#projects;
	}
	/**
	 * Get a `Project` by its mod ID
	 * @param modID The ID of the mod whose `Project` to get
	 * @param includeDependencies Whether to search through dependencies aswell
	 * @returns The `Project` if found
	 */
	getByID(modID: string, includeDependencies: boolean = true): Option<Project> {
		return (includeDependencies ? this.getAll() : this.getOpened())
			.find(p => p.getModJson().id === modID);
	}
	getProjectForDocument(uri: Uri): Option<Project> {
		const w = workspace.getWorkspaceFolder(uri);
		// Dependencies don't have their codebase available so you can't find 
		// those from a document
		return this.#projects.find(p => p.getWorkspacePath() === w?.uri.fsPath);
	}
}
