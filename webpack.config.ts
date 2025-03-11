//@ts-check

"use strict";

import { Configuration, Compiler } from "webpack";
import { createGenerator } from "ts-json-schema-generator";
import { mkdirSync, writeFileSync } from "fs";

const path = require("path");

class JsonValidationGenner {
	apply(compiler: Compiler) {
		compiler.hooks.compile.tap("generate mod.json validation", () => {
			const schema = createGenerator({
				path: "./src/project/ModJson.ts",
				tsconfig: "./tsconfig.json",
				type: "ModJson",
				markdownDescription: true,
				extraTags: ["deprecationMessage"]
			}).createSchema("ModJson");
			// scary to hardcode dist folder but oh well
			mkdirSync("./dist/validation", { recursive: true });
			writeFileSync("./dist/validation/mod.json", JSON.stringify(schema));
		});
	}
}

const extensionConfig: Configuration = {
	target: "node",
	mode: "none",
	entry: "./src/extension.ts",
	output: {
		path: path.resolve(__dirname, "dist"),
		filename: "extension.js",
		libraryTarget: "commonjs2",
	},
	externals: {
		vscode: "commonjs vscode",
		sharp: "sharp",
	},
	resolve: {
		extensions: [".ts", ".js"],
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: "ts-loader",
					},
				],
			},
		],
	},
	devtool: "nosources-source-map",
	infrastructureLogging: {
		level: "log", // enables logging required for problem matchers
	},
	plugins: [new JsonValidationGenner()],
};
module.exports = [extensionConfig];
