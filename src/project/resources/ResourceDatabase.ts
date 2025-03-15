import { existsSync, readFileSync } from "fs";
import { readdirRecursiveSync } from "../../utils/general";
import { Err, Future, None, Ok, Option } from "../../utils/monads";
import { GeodeCLI, Profile } from "../GeodeCLI";
import { Project, ProjectDatabase } from "../Project";
import { AudioResource, FontResource, SpriteFrameResource, SpriteResource, SpriteSheetResource, Resource, Source, ResourceSaveData, FileResource, SourceID, sourceID, UnknownResource } from "./Resource";
import { basename, join as pathJoin } from "path";
import { getPreferredQualityName, removeQualityDecorators } from "../../utils/resources";
import G = require("glob");
import { getOutputChannel } from "../../config";
import { GeodeSDK } from "../GeodeSDK";
import { ModJson } from "../ModJson";
import { Uri } from "vscode";

// todo: option to ignore custom songs / music library audio files

export type ResourceType =
    | "all"
    | "favorites"
    | "sprites"
    | "frames"
    | "spritesheets"
    | "fonts"
    | "audio"
    | "unknown";

function makeModCollectionID(modID: string) {
    return `mod:${modID}`;
}

function findModResources(src: Source, modJson: ModJson, resourcesDir: string): Resource[] {
    const resources: Resource[] = [];

    const globOptions: G.GlobOptions = {
        cwd: resourcesDir,
        absolute: true,
    };

    // Find sprites & audio files
    [...modJson.resources?.files ?? [], ...modJson.resources?.sprites ?? []]
        .flatMap(f => G.glob.sync(f, globOptions).map(p => p.toString()))
        .forEach(file => {
            if (file.endsWith(".ogg") || file.endsWith(".mp3")) {
                resources.push(new AudioResource(src, file));
            }
            else if (file.endsWith(".png") || file.endsWith(".jpg")) {
                resources.push(new SpriteResource(src, file));
            }
            else {
                resources.push(new UnknownResource(src, file));
            }
        });

    // Find spritesheets & their contained sprites
    Object.entries(modJson.resources?.spritesheets ?? {})?.forEach(([sheetName, patterns]) => {
        const sheet = new SpriteSheetResource(src, sheetName);
        for (const file of patterns.flatMap((p) => G.glob.sync(p, globOptions).map(p => p.toString()))) {
            const frame = new SpriteFrameResource(src, sheet, file, true);
            resources.push(frame);
            sheet.addFrame(frame);
        }
        resources.push(sheet);
    });

    // Find fonts
    Object.entries(modJson.resources?.fonts ?? {}).forEach(([name, font]) => {
        resources.push(new FontResource(src, pathJoin(resourcesDir, font.path)));
    });

    return resources;
}

export abstract class ResourceCollection {
    abstract getID(): string;
    abstract getDisplayName(): string;
    abstract reload(): Future;
    abstract getAllResources(): Resource[];

    public findResourceByName(name: string): Option<Resource> {
        let resource = this.getAllResources().find(r => r.getDisplayName() === name);
        if (resource) {
            return resource;
        }
        return None;
    }
    public findResourceByID(id: string): Option<Resource> {
        let resource = this.getAllResources().find(r => r.getID() === id);
        if (resource) {
            return resource;
        }
        return None;
    }
    public getResources(filter: ResourceType = "all"): Resource[] {
        let resources = this.getAllResources();
        switch (filter) {
            case "all":          break;
            case "favorites":    resources = resources.filter(r => r.isFavorite()); break;
            case "sprites":      resources = resources.filter(r => r instanceof SpriteResource); break;
            case "frames":       resources = resources.filter(r => r instanceof SpriteFrameResource); break;
            case "spritesheets": resources = resources.filter(r => r instanceof SpriteSheetResource); break;
            case "fonts":        resources = resources.filter(r => r instanceof FontResource); break;
            case "audio":        resources = resources.filter(r => r instanceof AudioResource); break;
            case "unknown":      resources = resources.filter(r => r instanceof UnknownResource); break;
            default: filter satisfies never; // exhaustiveness check
        }
        return resources;
    }
    public getFramesInSpriteSheet(sheetID: string): SpriteFrameResource[] {
        const sheet = this.findResourceByID(sheetID);
        return sheet instanceof SpriteSheetResource ? sheet.getFrames() : [];
    }
    public getStats(): Record<ResourceType, { count: number }> {
		const result = {
            all: { count: 0 },
            favorites: { count: 0 },
            audio: { count: 0 },
            fonts: { count: 0 },
            frames: { count: 0 },
            spritesheets: { count: 0 },
            sprites: { count: 0 },
            unknown: { count: 0 },
        } satisfies ReturnType<ResourceCollection["getStats"]>;

		for (const resource of this.getAllResources()) {
            result.all.count += 1;
            if (resource.isFavorite()) {
                result.favorites.count += 1;
            }
			if (resource instanceof SpriteResource) {
                result.sprites.count += 1;
			}
			else if (resource instanceof SpriteSheetResource) {
                result.spritesheets.count += 1;
			}
			else if (resource instanceof SpriteFrameResource) {
                result.frames.count += 1;
			}
			else if (resource instanceof FontResource) {
                result.fonts.count += 1;
			}
			else if (resource instanceof AudioResource) {
                result.audio.count += 1;
			}
            else {
                result.unknown.count += 1;
            }
		}
        return result;
    }
}

class AllResourceCollection extends ResourceCollection {
    #db: ResourceDatabase;

    constructor(db: ResourceDatabase) {
        super();
        this.#db = db;
    }

    getID(): string {
        return "all";
    }
    getDisplayName(): string {
        return "All";
    }
    async reload(): Future {
        return Ok();
    }
    getAllResources(): Resource[] {
        return this.#db.getCollections()
            .filter(c => !(c instanceof AllResourceCollection))
            .flatMap(c => c.getResources());
    }
}

abstract class ActualResourceCollection<S extends Source> extends ResourceCollection {
    #source: S;
    protected resources: Resource[];

    constructor(source: S) {
        super();
        this.#source = source;
        this.resources = [];
    }

    getSource(): S {
        return this.#source;
    }
    getAllResources(): Resource[] {
        return this.resources;
    }
}

class GDResourceCollection extends ActualResourceCollection<Profile> {
    constructor(profile: Profile) {
        super(profile);
    }

    async reload(): Future {
        getOutputChannel().appendLine(
            `Loading resources from profile ${this.getSource().getName()} (${this.getSource().getExecutablePath()})...`
        );

        let resourcesDir;
        if (process.platform === "darwin") {
            // macos is special, as always
            resourcesDir = pathJoin(this.getSource().getExecutablePath(), "Resources");
        }
        else {
            resourcesDir = pathJoin(this.getSource().getDirectory(), "Resources");
        }

        let files: string[];
        try {
            files = readdirRecursiveSync(resourcesDir);
        }
        catch (_) {
            return Ok();
        }

        this.resources = [];

        for (const file of files) {
            // Find spritesheets
            if (file.endsWith(".plist")) {
                // Check if this is a spritesheet (does it have a corresponding .png file)
                if (!existsSync(file.replace(".plist", ".png"))) {
                    continue;
                }

                const sheetPath = getPreferredQualityName(file);

                // Check if this sheet has already been added
                if (this.resources.some(r => r instanceof SpriteSheetResource && r.containedInPath(sheetPath))) {
                    continue;
                }

                const frames: SpriteFrameResource[] = [];
                const sheetName = removeQualityDecorators(basename(sheetPath));
                const sheet = new SpriteSheetResource(this.getSource(), sheetPath);

                // Read sheet data and find all *.png strings inside
                readFileSync(sheetPath)
                    .toString()
                    .match(/\w+\.png/g)
                    ?.forEach((match) => {
                        match = removeQualityDecorators(match);
                        if (
                            // Check that this is not the same as the sheet (metadata field)
                            match.replace(".png", ".plist") !== sheetName &&
                            // Make sure sprite isn't already added to sheet
                            !frames.some(spr => spr.getDisplayName() === match)
                        ) {
                            const frame = new SpriteFrameResource(this.getSource(), sheet, match);
                            this.resources.push(frame);
                            sheet.addFrame(frame);
                        }
                    });

                this.resources.push(sheet);
            }
            // Find fonts
            else if (file.endsWith(".fnt")) {
                const fontPath = getPreferredQualityName(file);
                if (this.resources.some(r => r instanceof FontResource && r.containedInPath(fontPath))) {
                    continue;
                }
                this.resources.push(new FontResource(this.getSource(), fontPath));
            }
            // Find audio
            else if (file.endsWith(".ogg")) {
                const audioPath = getPreferredQualityName(file);
                if (this.resources.some(r => r instanceof AudioResource && r.containedInPath(audioPath))) {
                    continue;
                }
                this.resources.push(new AudioResource(this.getSource(), audioPath));
            }
            // Find sprites
            else if (file.endsWith(".png")) {
                const filePath = getPreferredQualityName(file);
                if (
                    // Is this a spritesheet?
                    existsSync(filePath.replace(".png", ".plist")) ||
                    // Is this a font?
                    existsSync(filePath.replace(".png", ".fnt")) ||
                    // Has this sprite been added already?
                    this.resources.some(r => r instanceof FileResource && r.containedInPath(filePath))
                ) {
                    continue;
                }
                this.resources.push(new SpriteResource(this.getSource(), filePath));
            }
        }

        getOutputChannel().appendLine(`Found ${this.resources.length} for profile ${this.getSource().getName()}`);

        return Ok();
    }
    getID(): string {
        return `gd:${this.getSource().getExecutablePath()}`;
    }
    getDisplayName(): string {
        return `Geometry Dash (${this.getSource().getName()})`;
    }
}

class ModResourceCollection extends ActualResourceCollection<Project> {
    constructor(mod: Project) {
        super(mod);
    }

    async reload(): Future {
        getOutputChannel().appendLine(
            `Loading resources from mod ${this.getSource().getModJson().id} (${this.getSource().getPath()})...`
        );

        this.resources = findModResources(
            this.getSource(),
            this.getSource().getModJson(),
            this.getSource().getPath()
        );

        getOutputChannel().appendLine(`Found ${this.resources.length} for mod ${this.getSource().getModJson().id}`);

        return Ok();
    }
    getID(): string {
        return makeModCollectionID(this.getSource().getModJson().id);
    }
    getDisplayName(): string {
        let name = this.getSource().getModJson().name;
        const depOf = this.getSource().getDependencyOf();
        if (depOf.length) {
            name += ` (${depOf.map(p => p.getModJson().name).join(", ")})`;
        }
        return name;
    }
}

export type UserSaveData = { [sourceID: string]: { [resourceID: string]: ResourceSaveData } };

export class ResourceDatabase {
    #collections: ResourceCollection[] = [];
    #loadedUserOptionsData: UserSaveData = {};

    static #sharedInstance = new ResourceDatabase();

    public static get(): ResourceDatabase {
        return this.#sharedInstance;
    }

    private getSources(): Source[] {
        let res: Source[] = [];
        let profile = GeodeCLI.get()?.getCurrentProfile();
        if (profile) {
            res.push(profile);
        }
        res = res.concat(...ProjectDatabase.get().getAll());
        return res;
    }
    public async reloadAll(): Future<undefined, string[]> {
        getOutputChannel().appendLine("Loading resources...");
        const promises = [];
        this.#collections = [new AllResourceCollection(this)];
        for (const src of this.getSources()) {
            if (src instanceof Project) {
                this.#collections.push(new ModResourceCollection(src));
            }
            else if (src instanceof Profile) {
                this.#collections.push(new GDResourceCollection(src));
            }
            else {
                // exhaustiveness check
                src satisfies never;
            }
            promises.push(this.#collections.at(-1)!.reload());
        }
        const errors = (await Promise.all(promises)).map(r => r.getError()).filter(r => r !== None);
        return errors.length ? Err(errors) : Ok();
    }
    public async setup(): Future {
        await this.reloadAll();
        ProjectDatabase.get().onProjectsChange(
            project => project ?
                this.getCollectionForModID(project.getModJson().id)?.reload() :
                this.reloadAll()
        );
        return Ok();
    }

    public loadUserOptions(data: UserSaveData) {
        this.#loadedUserOptionsData = data;
        for (const [id, collection] of Object.entries(this.#collections)) {
            if (id in this.#loadedUserOptionsData) {
                for (const resource of collection.getResources()) {
                    resource.loadUserOptions(
                        this.#loadedUserOptionsData[id][resource.getID()]
                    );
                }
            }
        }
    }
    public saveUserOptions(): UserSaveData {
        for (const [id, collection] of Object.entries(this.#collections)) {
            if (!(id in this.#loadedUserOptionsData)) {
                this.#loadedUserOptionsData[id] = {};
            }
            for (const resource of collection.getResources()) {
                this.#loadedUserOptionsData[id][resource.getID()] = resource.saveUserOptions();
            }
        }
        return this.#loadedUserOptionsData;
    }

    public getCollection(collectionID: string): Option<ResourceCollection> {
        return this.#collections.find(c => c.getID() === collectionID);
    }
    public getCollectionForModID(modID: string): Option<ResourceCollection> {
        return this.getCollection(makeModCollectionID(modID));
    }
    public getCollections(): ResourceCollection[] {
        return Object.values(this.#collections);
    }

    public tryFindResourceFromUse(documentURI: Uri, modID: Option<string>, name: string, hasSprSuffix: boolean): Option<Resource> {
        if (hasSprSuffix) {
            if (!modID) {
                const project = ProjectDatabase.get().getProjectForDocument(documentURI);
                if (!project) {
                    return None;
                }
                modID = project.getModJson().id;
            }
            return ResourceDatabase.get()
                .getCollectionForModID(modID)
                ?.findResourceByName(name);
        }
        else {
            if (modID) {
                return ResourceDatabase.get()
                    .getCollectionForModID(modID)
                    ?.findResourceByName(name);
            }
            else {
                return ResourceDatabase.get()
                    .getCollection("all")
                    ?.findResourceByName(name);
            }
        }
    }
}
