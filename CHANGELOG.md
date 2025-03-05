# Geode for VS Code Changelog

## [1.19.2]
 - Fix lint for missing resources having poor performance & not updating on resource change
 - Add option to disable lints alltogether

## [1.19.1]
 - Bundle separate .vsix per platform, making it smaller
   - Extension is now ~10mb instead of 50mb!

## [1.19.0]
 - Add lint for missing resources, or missing `_spr`
 - Fix many issues with sprite browser (#23)

## [1.18.1]
 - Fix syntax highlighting for Broma

## [1.18.0]
 - Geode 4.2.0 `mod.json` changes: `dependencies` and `incompatibilities` may now be objects, and `dependencies.[id]` may specify `settings` for dependency-specific settings

## [1.17.0]
 - Rename `cheats` tag to `cheat` (#20, #21)
 - Suggest methods available to hook inside of modify class (#5)

## [1.16.0]
 - Remove the `Geode: Publish` command as it no longer works

## [1.15.2]
 - Disable extension if no mod.json is found within workspace
 - Fix linter triggering on comments
 - Fix quick fix inserting wrong syntax

## [1.15.1]
 - Add `modtober24` tag

## [1.15.0]
 - Improve `mod.json` validation by generating it from TypeScript, along with support for Settings V3.

## [1.14.0]
 - Add preliminary linting features for settings (checks for invalid setting names)
 - Add support for 2.206 color tags in `FLAlertLayer` (`<ca>`, `<cc>`, `<cd>`, `<cf>`, `<cs>`)

## [1.13.4]
 - Actually include sharp binaries for all platforms, by switching to pnpm

## [1.13.3]
 - Include sharp binaries for every platform, preventing issues on non Windows

## [1.13.2]
 - Add new keys to `mod.json` like `tags`, `superseded`, and etc
 - Action is now published from GitHub workflow

## [1.13.1]
 - Undeprecate `repository` in `mod.json` since `links` isn't implemented client-side yet

## [1.13.0]
 - Add support for `links` property in `mod.json`
 - Improve color editor support; `ccc3` and `ccc4` calls are now colorized as well as some other changes

## [1.12.0]
 - Add support for colorizing the `<ca>` color tag in `FLAlertLayer`s

## [1.11.0]
 - Update `mod.json` validation to support platform-specific settings

## [1.10.0]
 - Update `mod.json` validation to support platform-specific setting default values
 - Fix hex color validation in `mod.json`

## [1.9.0]
 - Update `mod.json` validation to support platform-specific dependencies

## [1.8.2]
 - Include Sharp binaries on all platforms

## [1.8.1]
 - Include Sharp binaries on Windows

## [1.8.0]
 - Change `Launch Geometry Dash` command to use `geode run`

## [1.7.0]
 - Update `mod.json` validation to support multiple developers

## [1.6.0]
 - Update `mod.json` validation
 - Fix Linux not being able to detect CLI path

## [1.5.1]
 - Bump minimum CLI version to 2.5.0
 - General bugfixes & improvements

## [1.5.0]
 - Add syntax highlighting for Broma files

## [1.4.0]
 - Preview sprite on hover
 - View setting info by hovering
 - Fix sprites from the current mod not showing up in Sprite Browser

## [1.3.0]
 - Colorization for color literals in code

## [1.2.0]
 - Colorization for `FLAlertLayer` tags inside string literals

## [1.1.1]
 - Fix `mod.json` validation incorrectly using `api.headers` instead of `api.include`
 - Fix CLI commands not working if CLI path has spaces (#1)

## [1.1.0]
 - Searching in Sprite Browser now shows amount of results
 - Updated `mod.json` validation
 - Add `Geode: Publish Mod` command for publishing the opened project on the mods index

## [1.0.1]
 - Added `workspaceContains:**/mod.json` activation event
 - Update README

## [1.0.0]
 - Initial release
