import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const result = await build({
  entryPoints: ['plugin/server/bridge-source.mjs'],
  outfile: 'plugin/server/bridge.mjs',
  bundle: true, platform: 'node', target: 'node22', format: 'esm', metafile: true,
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" }
});
const directories = new Set();
for (const input of Object.keys(result.metafile.inputs)) {
  if (!input.includes('node_modules/')) continue;
  let directory = dirname(input);
  while (directory !== '.') {
    try {
      const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
      if (pkg.name) {
        directories.add(directory);
        break;
      }
      directory = dirname(directory);
    } catch { directory = dirname(directory); }
  }
}
const notices = [];
for (const directory of [...directories].sort()) {
  const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  const license = await readFile(join(directory, 'LICENSE'), 'utf8');
  notices.push(`${pkg.name} ${pkg.version} - ${pkg.license}\n\n${license.replace(/[ \t]+$/gm, '')}`);
}
await writeFile('plugin/server/THIRD_PARTY_NOTICES.txt', notices.join('\n\n'));
await writeFile('plugin/server/build-info.json', JSON.stringify({
  runtime: 'Node.js >=22',
  sdk: JSON.parse(await readFile('node_modules/@modelcontextprotocol/sdk/package.json', 'utf8')).version,
  bundler: JSON.parse(await readFile('node_modules/esbuild/package.json', 'utf8')).version,
  build: 'npm ci --ignore-scripts && npm run build'
}, null, 2) + '\n');
