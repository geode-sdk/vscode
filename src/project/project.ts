import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TextDocument } from 'vscode';
import { window, workspace } from 'vscode';
import type { Option } from '../utils/monads';
import { None, Some } from '../utils/monads';
import type { ModJson } from './mod';

export interface Project {
	path: string;
	modJson: ModJson;
	hasResources: () => boolean;
}

export function typeIsProject<T>(project: Project | T): project is Project {
	return (<Project>(project)).modJson !== undefined;
}

function projectFromFolder(path: string): Option<Project> {
	if (!existsSync(join(path, 'mod.json')))
		return None;

	return Some({
		path,
		modJson: JSON.parse(readFileSync(join(path, 'mod.json')).toString()),
		hasResources(): boolean {
			return this.modJson.resources !== undefined;
		},
	});
}

export function isModProjectOpen(): boolean {
	if (!workspace.workspaceFolders)
		return false;

	for (const folder of workspace.workspaceFolders)
		if (existsSync(join(folder.uri.path, 'mod.json')))
			return true;

	return false;
}

export function getOpenedProjects(): Project[] {
	if (!workspace.workspaceFolders?.length)
		return [];

	const projects: Project[] = [];
	for (const folder of workspace.workspaceFolders) {
		const project = projectFromFolder(folder.uri.fsPath);
		if (project)
			projects.push(project);
	}
	return projects;
}

export function getProjectFromDocument(document: TextDocument): Option<Project> {
	const uri = document.uri;
	if (uri) {
		const w = workspace.getWorkspaceFolder(uri);
		if (w)
			return projectFromFolder(w.uri.fsPath);
	}
	return undefined;
}

export function getActiveProject(): Option<Project> {
	if (!workspace.workspaceFolders?.length)
		return None;

	if (window.activeTextEditor)
		return getProjectFromDocument(window.activeTextEditor.document);

	else
		if (workspace.workspaceFolders.length === 1)
			return projectFromFolder(workspace.workspaceFolders[0].uri.fsPath);

	return None;
}
