/* eslint-disable @typescript-eslint/naming-convention */

export interface Font {
	/**
	 * Path to the font's TTF / OTF file (relative to mod root folder)
	 */
	path: string,
	/**
	 * Font size in points
	 * @minimum 0
	 */
	size: number,
	/**
	 * List of characters to include in the generated BM font. Default is 
	 * "32-126,8226"
	 * @pattern [0-9]+(-[0-9]+)?(,([0-9]+(-[0-9]+)?))*
	 * @default 32-126,8226
	 */
	charset?: string | null,
	/**
	 * If specified, will generate a black outline of the provided size around 
	 * the font's characters. Experimental!
	 * @minimum 0
	 */
	outline?: number | null,
}

export interface Resources {
	/**
	 * Files to include with the mod. Things like sounds, binaries, etc.
	 */
	files?: string[] | null,
	/**
	 * Sprites to include with the mod. The sprites will automatically have UHD, 
	 * HD and SD versions created of them
	 */
	sprites?: string[] | null,
	/**
	 * Fonts to include with the mod. Provided format should be TTF / OTF. 
	 * Fonts will be converted automatically into GD-compatible BM fonts by 
	 * Geode CLI before packaging. List the names of the fonts as keys
	 */
	fonts?: { [name: string]: Font } | null,
	/**
	 * The mod's sprite sheets. Sprite sheets are better optimized than using 
	 * individual image files, so using them for the majority of the sprites in 
	 * your mod is recommended. List the names of the mod's spritesheets as 
	 * keys, and as their values a list of files to include in the sheet
	 */
	spritesheets?: { [name: string]: string[] } | null,
}

export type ShortPlatformIDNoArch = "win" | "mac" | "android" | "ios";
export type ShortPlatformIDArch = "win" | "mac" | "mac-arm" | "mac-intel" | "android32" | "android64" | "ios";
export type ShortPlatformID = ShortPlatformIDArch | ShortPlatformIDNoArch;
export type ShortPlatformIDOrGeneric = ShortPlatformID | "desktop" | "mobile";
export type PlatformID = ShortPlatformID | "windows";

/**
 * A version meta tag. Geode only supports a limited set of tags
 */
export type VersionTag = "alpha" | "beta" | "prerelease" | "pr";

/**
 * A version number, as in X.Y.Z. May contain a leading "v", and may contain 
 * build metadata, such as X.Y.Z-alpha.2
 */
export type Version =
	| `${number}.${number}.${number}`
	| `${number}.${number}.${number}-${VersionTag}`
	| `${number}.${number}.${number}-${VersionTag}.${number}`
	| `v${number}.${number}.${number}`
	| `v${number}.${number}.${number}-${VersionTag}`
	| `v${number}.${number}.${number}-${VersionTag}.${number}`;

/**
 * A Geometry Dash version number, such as 2.206
 */
export type GDVersion = `${number}.${number}`;

export type ColorRGB =
	/** 
	 * @pattern ^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$
	 */
	| string
	| [number, number, number]
	| { r: number; g: number; b: number };

export type ColorRGBA =
	/** 
	 * @pattern ^#?([A-Fa-f0-9]{8}|[A-Fa-f0-9]{4})$
	 */
	| string
	| [number, number, number, number]
	| { r: number; g: number; b: number; a: number };

export type SettingDefaultValue<T> = T | {
	win?: T,
	mac?: T,
	android?: T,
	ios?: T,
};

export interface SettingBase {
	/**
	 * Type of the setting. See [the docs](https://docs.geode-sdk.org/mods/settings#setting-types) 
	 * for information on what types are available, and how to use custom types
	 * @pattern ([a-z]+:)?(a-z0-9\-_)+
	 */
	type: string,
	/**
	 * Human-readable name for the setting. Used in the UI. If not present, the 
	 * ID of the setting will be used instead
	 */
	name?: string,
	/**
	 * Description for what the setting does
	 */
	description?: string,
	/**
	 * If this setting should only be available on certain platforms, specify 
	 * this property; by default, Geode assumes settings are available on all 
	 * platforms
	 */
	platforms?: ShortPlatformIDOrGeneric[],
}
export interface ValueSetting extends SettingBase {
	/**
	 * The default value for this setting
	 */
	"default"?: SettingDefaultValue<any>,
	/**
	 * Controls whether this setting should be enabled, based on the values of 
	 * other settings. See [the docs](https://docs.geode-sdk.org/mods/settings#enable-if) 
	 * for the syntax
	 */
	"enable-if"?: string,
	/**
	 * If the "enable-if" clause is considerably complicated, you can use this 
	 * to specify a human-readable description for what the user should do to 
	 * enable the setting. If not provided, Geode will synthesize one from the 
	 * "enable-if" clause itself. Should be formatted as an order on what to do 
	 * to enable the setting, like "Enable the Catfishing Feature"
	 */
	"enable-if-description"?: string,
	/**
	 * Whether this setting requires the game to be restarted whenever its value 
	 * is changed
	 */
	"requires-restart"?: boolean,
}
export interface TitleSetting extends SettingBase {
	type: "title",
}
export interface BoolSetting extends ValueSetting {
	type: "bool";
	default: SettingDefaultValue<boolean>;
}
export interface IntSetting extends ValueSetting {
	type: "int",
	/**
	 * Default value for this setting
	 */
	default: SettingDefaultValue<number>,
	/**
	 * Default value for this setting
	 * @asType integer
	 */
	min?: number,
	/**
	 * Default value for this setting
	 * @asType integer
	 */
	max?: number,
	/**
	 * Change the setting's UI
	 */
	control?: {
		/**
		 * Enable the small (green) arrow controls
		 */
		"arrows"?: boolean,
		/**
		 * Control how much the small (green) arrows should increment/decrement 
         * the setting's value when clicked
		 * @asType integer
		 */
		"arrow-step"?: number,
		/**
		 * Enable the secondary (pink) arrow controls
		 */
		"big-arrows"?: boolean,
		/**
		 * Control how much the secondary (pink) arrows should increment/
         * decrement the setting's value when clicked. This should be a larger 
		 * value than the small (green) arrows
		 * @asType integer
		 */
		"big-arrow-step"?: number,
		/**
		 * Enable the slider
		 */
		"slider"?: boolean,
		/**
		 * Control the slider's snap step size
		 * @asType integer
		 */
		"slider-step"?: number,
		/**
		 * Enable the text input
		 */
		"input"?: boolean,
	},
}
export interface FloatSetting extends ValueSetting {
	type: "float",
	/**
	 * Default value for this setting
	 */
	default: SettingDefaultValue<number>,
	/**
	 * Minimum value for this setting
	 * @asType number
	 */
	min?: number,
	/**
	 * Maximum value for this setting
	 * @asType number
	 */
	max?: number,
	/**
	 * Change the setting's UI
	 */
	control?: {
		/**
		 * Enable the small (green) arrow controls
		 */
		"arrows"?: boolean,
		/**
		 * Control how much the small (green) arrows should increment/decrement 
         * the setting's value when clicked
		 * @asType number
		 */
		"arrow-step"?: number,
		/**
		 * Enable the secondary (pink) arrow controls
		 */
		"big-arrows"?: boolean,
		/**
		 * Control how much the secondary (pink) arrows should increment/
         * decrement the setting's value when clicked. This should be a larger 
		 * value than the small (green) arrows
		 * @asType number
		 */
		"big-arrow-step"?: number,
		/**
		 * Enable the slider
		 */
		"slider"?: boolean,
		/**
		 * Control the slider's snap step size
		 * @asType number
		 */
		"slider-step"?: number,
		/**
		 * Enable the text input
		 */
		"input"?: boolean,
	},
}
export interface StringSetting extends ValueSetting {
	type: "string",
	default: SettingDefaultValue<string>,
	/**
	 * A regex the string must match
	 */
	match?: string,
	/**
	 * List of all the allowed characters, similar to `CCTextInputNode`
	 */
	filter?: string,
	/**
	 * A list of the allowed values for the string. Turns the setting into a 
	 * selection list instead of an input
	 */
	"one-of"?: string[],
}
// todo in Geode v4: remove this
export interface PathSetting extends ValueSetting {
	/**
	 * @deprecated Use the "file" or "folder" type instead
	 */
	type: "path",
	default: SettingDefaultValue<string>,
	control?: {
		/**
		 * The dialog to show when the user clicks the file selection button in 
		 * the UI
		 */
		dialog?: "open" | "save",
		/**
		 * Filter options to show in the file pick dialog. The option 
		 * "All files (*.*)" will always be included alongside these by default
		 */
		filters?: {
			/**
			 * Filter description, like "Level Files"
			 */
			description?: string;
			/**
			 * File wildcard to match. Can be for example `*.gmd`, `*.gmd2`, or 
			 * `Steve.txt`
			 */
			files?: string[];
		}[],
	},
}
export interface FileSetting extends ValueSetting {
	type: "file",
	default: SettingDefaultValue<string>,
	control?: {
		/**
		 * The dialog to show when the user clicks the file selection button in 
		 * the UI
		 */
		dialog?: "open" | "save",
		/**
		 * Filter options to show in the file pick dialog. The option 
		 * "All files (*.*)" will always be included alongside these by default
		 */
		filters?: {
			/**
			 * Filter description, like "Level Files"
			 */
			description?: string;
			/**
			 * File wildcard to match. Can be for example `*.gmd`, `*.gmd2`, or 
			 * `Steve.txt`
			 */
			files?: string[];
		}[],
	},
}
export interface FolderSetting extends ValueSetting {
	type: "folder",
	default: SettingDefaultValue<string>,
}
export interface ColorSetting extends ValueSetting {
	type: "color" | "rgb",
	default: SettingDefaultValue<ColorRGB>,
}
export interface ColorAlphaSetting extends ValueSetting {
	type: "rgba",
	default: SettingDefaultValue<ColorRGBA>,
}
/**
 * @additionalProperties true
 */
export interface LegacyCustomSetting extends SettingBase {
	/**
	 * @deprecated Use custom setting types (i.e. `custom:my-type-name`) instead. 
     * See [our docs](https://docs.geode-sdk.org/mods/settings) for more
	 */
	type: "custom",
	[other: string]: unknown,
}
/**
 * @additionalProperties true
 */
export interface CustomTypeSetting extends ValueSetting {
	/**
	 * @pattern custom:[a-z]+
	 */
	type: string,
	[other: string]: unknown,
}
export type Setting = 
	| TitleSetting
	| BoolSetting
	| IntSetting
	| FloatSetting
	| StringSetting
	| FileSetting
	| PathSetting
	| FolderSetting
	| ColorSetting
	| ColorAlphaSetting
	| LegacyCustomSetting
	| CustomTypeSetting;

export interface Dependency {
	/**
	 * ID of the dependency
	 * @pattern [a-z0-9\-_]+\.[a-z0-9\-_]+
	 */
	id: string,
	/**
	 * Version of the dependency. Geode assumes the mod follows [semver](https://semver.org); 
	 * this means that versions "1.5.3" and "1.4.0" will be considered valid 
	 * for dependency version "1.4.5" but "2.1.0" would not be valid
	 */
	version: Version,
	/**
	 * Whether the dependency is required in order to load this mod
	 * @deprecated Use the "importance" property instead
	 */
	required?: boolean,
	/**
	 * Whether this dependency is required for the mod to work, or only 
	 * recommended for users
	 */
	importance: "required" | "recommended" | "suggested",
	/**
	 * If this dependency should only be on certain platforms, specify this 
	 * property; by default, Geode assumes dependencies are used on all 
	 * platforms
	 */
	platforms?: ShortPlatformIDOrGeneric[],
}
export interface Incompatibility {
	/**
	 * ID of the incompatability
	 * @pattern [a-z0-9\-_]+\.[a-z0-9\-_]+
	 */
	id: string,
	/**
	 * Version of the incompatability. Geode assumes the mod follows [semver](https://semver.org); 
	 * this means that versions "1.5.3" and "1.4.0" will be considered valid 
	 * for incompatability version "1.4.5" but "2.1.0" would not be valid
	 */
	version: Version,
	/**
	 * How kind of an incompatibility this is
	 */
	importance:
		/**
		 * This mod does not work with the incompatible mod
		 */
		"breaking" |
		/**
		 * This mod might work with the incompatible mod, but there will be bugs
		 */
		"conflicting" | 
		/**
		 * This mod is a newer version/alternative for the incompatible mod. 
		 * Geode will present this to the user and allow them to automatically 
		 * migrate from the old mod to this one
		 */
		"superseded",
	/**
	 * If this incompatibility should only be on certain platforms, specify 
	 * this property; by default, Geode assumes incompatibilities are used on 
	 * all platforms
	 */
	platforms?: ShortPlatformIDOrGeneric[],
}

/**
 * A tag for a mod. See [the docs](https://docs.geode-sdk.org/mods/configuring#tags) 
 * for information on what all the tags mean
 */
export type Tag = 
	"universal" |
	"gameplay" |
	"editor" |
	"offline" |
	"online" |
	"enhancement" |
	"music" |
	"interface" |
	"bugfix" |
	"utility" |
	"performance" |
	"customization" |
	"content" |
	"developer" |
	"cheats" |
	"paid" |
	"joke" |
    "modtober24";

/**
 * Configuration options for a Geode mod. Specifies metadata like the name and 
 * version, as well as things like settings and resources
 */
interface ModJsonBase {
	/**
	 * The version of Geode this mod targets. Must be the version you currently 
	 * have installed on your machine
	 */
	geode: Version,
	/**
	 * The version of this mod. Mods should follow [strict semver](https://semver.org); 
	 * this ensures that mods that [use other mods as dependencies](https://docs.geode-sdk.org/mods/dependencies) 
	 * can do so safely
	 */
	version: Version,
	/**
	 * "What version of Geometry Dash this mod targets. Use \"*\" for any 
	 * version, or specify a version. \"*\" is for mods that only interact with 
	 * Cocos or other libraries, or can handle version checking themselves."
	 */
	gd: "*" | {
		"win"?: GDVersion,
		"mac"?: GDVersion,
		"android"?: GDVersion,
		"ios"?: GDVersion,
	},
	/**
	 * ID of the mod. This is used to uniquely distinguish the mod in places 
	 * like URLs, file names, etc.. Should be formatted as 
	 * \"developer.mod-name\". Note that the ID should never be changed after 
	 * initial release - that's what "name" is for!
	 * @pattern [a-z0-9\-_]+\.[a-z0-9\-_]+
	 */
	id: string,
	/**
	 * Name of the mod. May be anything, but do note that GD usually has limits 
	 * on what characters it can render
	 */
	name: string,
	/**
	 * Short, free-form description of the mod. Should be less than 45 
	 * characters long; use `about.md` for a more detailed description!
	 * @maxLength 45
	 */
	description?: string,
	/**
	 * URL of the mod's Git repository, or other equivalent homepage
	 * @deprecated Use the \"links\" key instead
	 */
	repository?: string,
	/**
	 * Links to websites and other online content related to the mod
	 */
	links?: {
		/**
		 * URL of the mod's home website
		 */
		homepage?: string,
		/**
		 * URL of the mod's Git repository, or wherever the mod's source code is available
		 */
		source?: string,
		/**
		 * A discussion community for the mod, like a Discord server
		 */
		community?: string,
	},
	/**
	 * List of mods this mod depends on. See [the docs](https://docs.geode-sdk.org/mods/dependencies) 
	 * for more information
	 */
	dependencies?: Dependency[] | null,
	/**
	 * List of mods this mod is incompatible with
	 */
	incompatibilities?: Incompatibility[] | null,
	resources?: Resources | null,
	/**
	 * The mod's settings. These are editable by the user in-game through the 
	 * mod's settings page. See [the docs page](https://docs.geode-sdk.org/mods/settings) 
	 * for more information
	 */
	settings?: { [id: string]: Setting },
	/**
	 * Info about where and how to report bugs and other issues regarding this 
	 * mod
	 */
	issues?: {
		/**
		 * Free-form info about where and how to report issues. Supports 
		 * markdown formatting
		 */
		info: string;
		/**
		 * URL for posting issues. Usually the GitHub issues page
		 */
		url?: string;
	},
	"early-load"?: boolean,
	/**
	 * Tags that describe what this mod is for. A recommended amount is 1-4 tags
	 */
	tags?: Tag[],
	/**
	 * Define that this mod should be used as a dependency. If this key is 
	 * present, the .lib file is automatically included in the .geode package
	 */
	api?: {
		/**
		 * Headers to include with the mod. Supports globbing
		 * @default ["include/*.hpp"]
		 */
		include: string[];
	},
}

interface ModJsonWithSingleDevImpl extends ModJsonBase {
	/**
	 * Name of the mod developer. If the mod has multiple developers, use the 
	 * "developers" key, or use a team name like "Geode Team"
	 */
	developer: string,
}
interface ModJsonWithMultiDevImpl extends ModJsonBase {
	/**
	 * Names of the mod's developers
	 */
	developers: string[],
}
export type ModJson = ModJsonWithSingleDevImpl | ModJsonWithMultiDevImpl;

// Mod runtime info, queried through loader IPC

export interface RTHook {
	address: number;
	detour: number;
	name: string;
	enabled: boolean;
}

export interface RTPatch {
	address: number;
	original: number[];
	patch: number[];
	applied: boolean;
}

export interface ModRunTimeInfo {
	hooks: RTHook[];
	patches: RTPatch[];
	enabled: boolean;
	loaded: boolean;
	"temp-dir": string;
	"save-dir": string;
	"config-dir": string;
}

export interface RTModJson extends ModJsonBase {
	path: string;
	binary: string;
	runtime: ModRunTimeInfo;
}
