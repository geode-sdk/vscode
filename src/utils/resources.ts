import { existsSync } from "fs";
import { getExtConfig } from "../config";

export function removeQualityDecorators(file: string) {
    return file.replace(/-uhd|-hd/g, "");
}
export function getPreferredQualityName(rawFile: string) {
    let ext = "";
    switch (getExtConfig().get<string>("textureQuality")) {
        case "High":
            ext = "-uhd";
            break;
        case "Medium":
            ext = "-hd";
            break;
    }

    // Replace suffix
    const file = removeQualityDecorators(rawFile)
        .replace(".png", `${ext}.png`)
        .replace(".plist", `${ext}.plist`);

    // Return preferred quality file if it exists, and original if not
    return existsSync(file) ? file : rawFile;
}
