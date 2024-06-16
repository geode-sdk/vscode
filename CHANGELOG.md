# Geode for VS Code Changelog

## [v1.13.1]

- Undeprecate `repository` in `mod.json` since `links` isn't implemented client-side yet

## [v1.13.0]

- Add support for `links` property in `mod.json`
- Improve color editor support; `ccc3` and `ccc4` calls are now colorized as well as some other changes

## [v1.12.0]

- Add support for colorizing the `<ca>` color tag in `FLAlertLayer`s

## [v1.11.0]

- Update `mod.json` validation to support platform-specific settings

## [v1.10.0]

- Update `mod.json` validation to support platform-specific setting default values
- Fix hex color validation in `mod.json`

## [v1.9.0]

- Update `mod.json` validation to support platform-specific dependencies

## [v1.8.2]

- Include Sharp binaries on all platforms

## [v1.8.1]

- Include Sharp binaries on Windows

## [v1.8.0]

- Change `Launch Geometry Dash` command to use `geode run`

## [v1.7.0]

- Update `mod.json` validation to support multiple developers

## [v1.6.0]

- Update `mod.json` validation
- Fix Linux not being able to detect CLI path

## [v1.5.1]

- Bump minimum CLI version to 2.5.0
- General bugfixes & improvements

## [v1.5.0]

- Add syntax highlighting for Broma files

## [v1.4.0]

- Preview sprite on hover
- View setting info by hovering
- Fix sprites from the current mod not showing up in Sprite Browser

## [v1.3.0]

- Colorization for color literals in code

## [v1.2.0]

- Colorization for `FLAlertLayer` tags inside string literals

## [v1.1.1]

- Fix `mod.json` validation incorrectly using `api.headers` instead of `api.include`
- Fix CLI commands not working if CLI path has spaces (#1)

## [v1.1.0]

- Searching in Sprite Browser now shows amount of results
- Updated `mod.json` validation
- Add `Geode: Publish Mod` command for publishing the opened project on the mods index

## [v1.0.1]

- Added `workspaceContains:**/mod.json` activation event
- Update README

## [v1.0.0]

- Initial release
