
import { spawn } from "child_process";
import { Future, Ok, Err } from "../utils/monads";
import { cli } from "./cli";

export namespace gd {
    export async function launchGD(): Future {
        const profile = cli.getCurrentProfile();
        if (!profile) {
            return Err('No profile selected!');
        }
        const exe = profile.gdExecutablePath;
        
        if (!exe) {
            return Err('No executable found for launch');
        }

        spawn(exe, {
            cwd: profile.gdPath,
            detached: true,
        });

        return Ok();
    }
}
