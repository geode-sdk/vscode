import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { TextEditor, window, workspace } from "vscode";
import { None, Option, Some } from "../utils/monads";
import { ModJson } from "./mod";

export interface Project {
    path: string,
    modJson: ModJson,
    hasResources(): boolean,
}

export function typeIsProject<T>(project: Project | T): project is Project {
    return (<Project>(project)).modJson !== undefined;
}

function projectFromFolder(path: string): Option<Project> {
    if (!existsSync(join(path, 'mod.json'))) {
        return None;
    }

    return Some({
        path: path,
        modJson: JSON.parse(readFileSync(join(path, 'mod.json')).toString()),

        hasResources(): boolean {
            return this.modJson.resources !== undefined;
        }
    });
}

export function isModProjectOpen(): boolean {
    if (!workspace.workspaceFolders) {
        return false;
    }
    for (const folder of workspace.workspaceFolders) {
        if (existsSync(join(folder.uri.path, 'mod.json'))) {
            return true;
        }
    }
    return false;
}

export function getOpenedProjects(): Project[] {
    if (!workspace.workspaceFolders?.length) {
        return [];
    }
    const projects: Project[] = [];
    for (const folder of workspace.workspaceFolders) {
        const project = projectFromFolder(folder.uri.path);
        if (project) {
            projects.push(project);
        }
    }
    return projects;
}

export function getActiveProject(): Option<Project> {
    if (!workspace.workspaceFolders?.length) {
        return None;
    }
    const uri = window.activeTextEditor?.document.uri;
    if (uri) {
        const w = workspace.getWorkspaceFolder(uri);
        if (w) {
            return projectFromFolder(w.uri.fsPath);
        }
    }
    return None;
}
