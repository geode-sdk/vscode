
import { readdirSync } from "fs";
import { join } from "path";

export function readdirRecursiveSync(dir: string) {
    let res: string[] = [];

    readdirSync(dir, { withFileTypes: true }).forEach((file) => {
        if (file.isDirectory()) {
            res = res.concat(readdirRecursiveSync(join(dir, file.name)));
        } else {
            res.push(join(dir, file.name));
        }
    });

    return res;
}

export function removeFromArray<T>(array: T[], item: T) {
	if (array.includes(item)) {
		array.splice(array.indexOf(item), 1);
	}
}

export function clamp(start: number, num: number, end: number): number {
	if (num < start) {
		return num;
	}
	if (num > end) {
		return end;
	}
	return num;
}
