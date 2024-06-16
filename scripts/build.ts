import { execSync } from 'node:child_process';
import fs from 'fs-extra';

async function build() {
    await fs.remove('./dist');
    execSync('tsup --format cjs --no-shims', { stdio: 'inherit' });
    ['LICENSE', 'README.md', '.vscodeignore', 'assets']
        .forEach(async f => await fs.copy(`./${f}`, `./dist/${f}`));

    const json = await fs.readJSON('./package.json');
    delete json.scripts;
    delete json.devDependencies;
    json.main = 'extension.js';
    await fs.writeJSON('./dist/package.json', json);
}

build();
