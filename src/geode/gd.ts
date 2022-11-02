
import { spawn } from "child_process";
import { accessSync, readdirSync } from "fs";
import { constants } from "fs";
import { join } from "path";
import { window } from "vscode";
import { getOutputChannel } from "../config";
import { Future, Ok, Err, Option, None } from "../utils/monads";
import { cli } from "./cli";

export namespace gd {
    function findExecutablesInDir(path: string): string[] {
        // get all executable files in directory
        const exes = [];
        for (const file of readdirSync(path)) {
            const p = join(path, file);
            if (process.platform === 'win32') {
                if (p.endsWith('.exe')) {
                    exes.push(p);
                }
            } else {
                // for some reason on Windows even folders are X_OK
                try {
                    accessSync(p, constants.X_OK);
                    exes.push(p);
                } catch {}
            }
        }
        return exes;
    }

    export async function launchGD(): Future<undefined, string> {
        if (cli.getCurrentProfile().isNone()) {
            return Err('No profile selected!');
        }
        const profile = cli.getCurrentProfile().unwrap();
        const exes = findExecutablesInDir(profile.gdPath);
        if (!exes.length) {
            return Err(
                `${profile.gdPath} does not appear to contain ` + 
                `any executable files`
            );
        }
        // if there's more than one executable in GD dir, have the 
        // user pick which one to launch
        const exe = exes.length > 1 ?
            await window.showQuickPick(exes, { canPickMany: false }) :
            exes[0];
        
        if (!exe) {
            return Err('No executable selected for launch');
        }

        spawn(exe, {
            cwd: profile.gdPath,
            detached: true,
        });

        return Ok();
    }
}
