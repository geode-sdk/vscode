import { Profile } from "../GeodeCLI";
import { Project } from "../Project";

export type Source = Profile | Project;

/**
 * Wrapper for a string ID to a `Source` so you don't accidentally pass just 
 * any arbitary string to a function expecting a `SourceID`
 */
export class SourceID {

    public static from(src: Source): SourceID {
        if (typeof src === "string") {
            return new SourceID(`dir:${src}`);
        } else if (src instanceof Project) {
            return new SourceID(`mod:${src.getModJson().id}`)
        } else if (src instanceof Profile) {
            return new SourceID(`gd:${src.getName()}`);
        } else {
            // exhaustiveness check
            return src satisfies never;
        }
    }

    private readonly id: string;

    constructor(id: string) {
        this.id = id;
    }

    public toString() {
        return this.id;
    }
}