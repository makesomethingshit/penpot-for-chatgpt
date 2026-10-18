import assert from 'node:assert/strict';
import { isReleaseVersion } from './release-version.mjs';
import { createRequire } from 'node:module';
// Resolve the locked SDK dependency from its owner, including nested npm layouts.
const { default: Ajv2020 } = createRequire(import.meta.resolve('@modelcontextprotocol/sdk/client/index.js'))('ajv/dist/2020.js');
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { resolve, relative, dirname, isAbsolute, sep } from 'node:path';

const json = async path => JSON.parse(await readFile(path, 'utf8'));
const pkg = await json('package.json');
const lock = await json('package-lock.json');
const sourceLicense = await readFile('LICENSE', 'utf8');
assert.match(sourceLicense, /^MIT License\n/);
assert.ok(sourceLicense.includes('Copyright (c) 2026 makesomethingshit'));
assert.equal(pkg.license, 'MIT');
assert.equal(lock.packages[''].license, pkg.license);
const marketplace = await json('.agents/plugins/marketplace.json');
assert.equal(marketplace.plugins.length, 1);
assert.equal(marketplace.plugins[0].source.source, 'local');
assert.equal(marketplace.plugins[0].source.path, './plugin');
process.chdir('plugin');
const pluginRoot = await realpath(process.cwd());
async function pluginPath(path) {
  const resolved = await realpath(path);
  const fromRoot = relative(pluginRoot, resolved);
  assert.ok(!isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`), 'Path escapes plugin');
  return resolved;
}
const plugin = await json(await pluginPath('plugin.json'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
for (const [path, schemaName] of [['plugin.json', 'plugin'], ['mcp.json', 'mcp']]) {
  const schema = JSON.parse(await readFile(new URL(`schemas/${schemaName}.schema.json`, import.meta.url), 'utf8'));
  const validate = ajv.compile(schema);
  assert.ok(validate(await json(await pluginPath(path))), `${path}: ${ajv.errorsText(validate.errors)}`);
}
const legacy = await json(await pluginPath('.codex-plugin/plugin.json'));
for (const field of ['name', 'version', 'description', 'author', 'homepage', 'repository', 'keywords', 'license']) {
  assert.deepEqual(legacy[field], plugin[field], `Compatibility manifest: ${field}`);
}
assert.equal(pkg.license, plugin.license);
assert.equal(await readFile(await pluginPath('LICENSE'), 'utf8'), sourceLicense, 'Packaged project license must match the source LICENSE');
assert.equal(pkg.version, plugin.version);
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
assert.equal(pkg.name, plugin.name);
assert.equal(marketplace.plugins[0].name, plugin.name);
assert.equal(legacy.skills, './skills');
assert.equal(legacy.mcpServers, './.mcp.json');
assert.deepEqual(legacy.interface, plugin.extensions['com.openai'].interface);
assert.ok(isReleaseVersion(plugin.version), 'Plugin release version must be valid SemVer (including prereleases)');
assert.ok(isReleaseVersion(pkg.dependencies['eventsource-parser']),
  'Direct eventsource-parser dependency must be pinned to an exact version');
assert.equal(lock.packages[''].dependencies?.['eventsource-parser'], pkg.dependencies['eventsource-parser'],
  'Lockfile root must declare the direct eventsource-parser dependency');
assert.equal(pkg.dependencies['eventsource-parser'], lock.packages['node_modules/eventsource-parser']?.version,
  'Directly imported eventsource-parser must be pinned in the lockfile');
const ui = legacy.interface;
for (const field of ['brandColor', 'brandColorDark']) {
  if (ui[field] !== undefined) assert.match(ui[field], /^#[0-9A-Fa-f]{6}$/);
}
for (const [field, limit] of [['displayName', 30], ['shortDescription', 30], ['longDescription', 4000], ['developerName', 80]]) {
  assert.ok(typeof ui[field] === 'string' && ui[field].trim() && [...ui[field]].length <= limit, `Interface: ${field}`);
}
assert.ok(typeof ui.category === 'string' && ui.category.trim());
assert.ok([...ui.longDescription].length <= 4000);
if (ui.defaultPrompt !== undefined) {
  const prompts = typeof ui.defaultPrompt === 'string' ? [ui.defaultPrompt] : ui.defaultPrompt;
  assert.ok(Array.isArray(prompts) && prompts.length <= 3);
  assert.ok(prompts.every(prompt => typeof prompt === 'string' && [...prompt].length <= 128));
  assert.equal(new Set(prompts).size, prompts.length, 'Starter prompts must be unique');
}
assert.ok(Array.isArray(ui.capabilities) && ui.capabilities.length <= 20);
assert.ok(ui.capabilities.every(label => typeof label === 'string' && [...label].length <= 120));
for (const path of [legacy.skills, legacy.mcpServers]) {
  await stat(await pluginPath(path));
}
for (const field of ['logo', 'logoDark', 'composerIcon', 'composerIconDark']) {
  assert.ok(typeof ui[field] === 'string' && ui[field].startsWith('./'), `Icon path: ${field}`);
  const path = await pluginPath(ui[field]);
  const image = await readFile(path);
  assert.ok(image.length >= 57, 'PNG icon is truncated');
  assert.ok(image.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), 'Invalid PNG signature');
  assert.equal(image.readUInt32BE(8), 13, 'Invalid PNG IHDR length');
  assert.equal(image.subarray(12, 16).toString(), 'IHDR');
  assert.ok(image.subarray(-12).equals(Buffer.from('0000000049454e44ae426082', 'hex')), 'Missing PNG IEND');
  assert.equal(image.readUInt32BE(16), image.readUInt32BE(20));
  assert.ok(image.readUInt32BE(16) >= 48 && image.readUInt32BE(16) <= 4096);
  assert.ok(image.length <= 5 * 1024 * 1024);
}
assert.deepEqual((await json(await pluginPath('mcp.json'))).mcpServers, (await json(await pluginPath('.mcp.json'))).mcpServers);
assert.deepEqual((await json(await pluginPath('mcp.json'))).mcpServers.penpot, {
  type: 'stdio', command: 'node', args: ['${PLUGIN_ROOT}/server/bridge.mjs'], cwd: '${PLUGIN_ROOT}'
});
assert.ok((await stat(await pluginPath('server/bridge.mjs'))).size > 0);
assert.equal((await json(await pluginPath('server/build-info.json'))).sdk, pkg.dependencies['@modelcontextprotocol/sdk']);
const skills = await readdir('skills');
assert.equal(skills.length, 5);
for (const name of skills) {
  const path = `skills/${name}/SKILL.md`;
  const text = await readFile(await pluginPath(path), 'utf8');
  assert.ok(text.startsWith(`---\nname: ${name}\n`) || text.startsWith(`---\r\nname: ${name}\r\n`));
  assert.match(text, /\ndescription: .+/);
  for (const match of text.matchAll(/\]\(([^)]+\.md)\)/g)) {
    await stat(await pluginPath(resolve(dirname(path), match[1])));
  }
}
console.log(`Portable package checks passed: ${plugin.name} ${plugin.version ?? '(unreleased)'}, ${skills.length} skills.`);
console.log('Versioned Codex overlay: desktop host import and release compatibility still require separate acceptance.');
process.chdir('..');
