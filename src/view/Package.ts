import { Option } from "../utils/monads";
import { Widget } from "./Widget";
import { AnyCharacterOf } from "./widgets/types/StringTypes";
import { Template } from "./widgets/types/Template";

export type WidgetClass = abstract new (...args: any[]) => Widget;

export interface Prototype extends Object {
    constructor: WidgetClass;
}

export class Resources {

    public static fromCSS(css: string): Resources {
        return new Resources(css, undefined);
    }

    public static fromJS(js: string): Resources {
        return new Resources(undefined, js);
    }

    public static fromResources(resources: {
        css: string,
        js: string
    }): Resources {
        return new Resources(resources.css, resources.js);
    }

    public static fromJSTemplate<T extends string>(template: T, ...args: Template<T>): Resources {
        return new Resources(undefined, template.replace(/%([ojdfislba])/g, (_, type: AnyCharacterOf<"ojdfislba">) => {
            const arg = args.shift();

            if (type == "o" && typeof arg == "string") {
                return arg;
            } else {
                return JSON.stringify(arg);
            }
        }));
    }

    private readonly css?: string;

    private readonly js?: string;

    private blacklisted: WidgetClass[]

    constructor(css?: string, js?: string) {
        this.css = css;
        this.js = js;
        this.blacklisted = [];
    }

    public getCSS(): Option<string> {
        return this.css;
    }

    public getJS(): Option<string> {
        return this.js;
    }

    // In case a resource is not needed through the current  resource, allow it to blacklist this specific resource
    public blacklist(...blacklisted: WidgetClass[]): this {
        this.blacklisted.push(...blacklisted);

        return this;
    }

    public getBlacklisted(): WidgetClass[] {
        return this.blacklisted;
    }
}

export class Package extends Map<WidgetClass, Resources[]> {

    private readonly fullBlacklisted: WidgetClass[];

    constructor(classObject?: Widget) {
        super();

        this.fullBlacklisted = [];

        if (classObject) {
            this.getHierarchy(classObject).forEach((subClass) => this.set(
                subClass,
                Object.values(subClass).filter((value) => value instanceof Resources)
            ));
        }
    }

    public getToBeAdded(other: Package): Package {
        const toBeAdded = new Package();

        other.forEach((resources, subClass) => {
            if (!this.has(subClass) && !this.fullBlacklisted.includes(subClass)) {
                toBeAdded.set(subClass, resources);
            }
        });

        return toBeAdded;
    }

    public merge(...others: Package[]): this {
        others.forEach((other) => other.forEach((resources, subClass) => this.set(subClass, resources)));

        return this;
    }

    public getJS(): string {
        return this.getResource((resources) => resources.getJS());
    }

    public getCSS(): string {
        return this.getResource((resources) => resources.getCSS());
    }

    public override set(subClass: WidgetClass, resources: Resources[]): this {
        const blacklisted = resources.flatMap((resources) => resources.getBlacklisted());

        this.fullBlacklisted.push(...blacklisted);
        blacklisted.forEach(this.delete, this);

        if (!this.fullBlacklisted.includes(subClass)) {
            super.set(subClass, resources);
        }

        return this;
    }

    private getResource(getter: (resources: Resources) => Option<string>): string {
        return Array.from(this.values())
            .flatMap((resources) => resources.map(getter))
            .filter(Boolean)
            .join("\n");
    }

    private getHierarchy(classObject: Widget): WidgetClass[] {
        const hierarchy = [];

        for (let proto: Prototype = Object.getPrototypeOf(classObject); proto.constructor != Widget; proto = Object.getPrototypeOf(proto)) {
            hierarchy.push(proto.constructor);
        }

        return hierarchy;
    }
}