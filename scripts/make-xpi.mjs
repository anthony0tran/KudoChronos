import { execSync } from 'child_process';
import { readFileSync, renameSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const { name, version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));

console.log('Building zip...');
execSync('wxt zip -b firefox', { cwd: root, stdio: 'inherit' });

const zipPath = resolve(root, '.output', `${name}-${version}-firefox.zip`);
const xpiPath = resolve(root, '.output', `${name}-${version}-firefox.xpi`);

if (!existsSync(zipPath)) {
    console.error(`Expected zip not found: ${zipPath}`);
    process.exit(1);
}

renameSync(zipPath, xpiPath);
console.log(`Created: .output/${name}-${version}-firefox.xpi`);

