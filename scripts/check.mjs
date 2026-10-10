import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
// Resolve the locked SDK dependency from its owner, including nested npm layouts.
const { default: Ajv2020 } = createRequire(import.meta.resolve('@modelcontextprotocol/sdk/client/index.js'))('ajv/dist/2020.js');
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';

const json = async path => JSON.parse(await readFile(path, 'utf8'));
const pkg = await json('package.json');
const lock = await json('package-lock.json');
const marketplace = await json('.agents/plugins/marketplace.json');
assert.equal(marketplace.plugins.length, 1);
assert.equal(marketplace.plugins[0].source.path, './plugin');
process.chdir('plugin');
const plugin = await json('plugin.json');
const ajv = new Ajv2020({ strict: false, allErrors: true });
for (const [path, schemaName] of [['plugin.json', 'plugin'], ['mcp.json', 'mcp']]) {
  const schema = JSON.parse(await readFile(new URL(`schemas/${schemaName}.schema.json`, import.meta.url), 'utf8'));
  const validate = ajv.compile(schema);
  assert.ok(validate(await json(path)), `${path}: ${ajv.errorsText(validate.errors)}`);
}
const legacy = await json('.codex-plugin/plugin.json');
for (const field of ['name', 'version', 'description', 'author', 'homepage', 'repository', 'keywords']) {
  assert.deepEqual(legacy[field], plugin[field], `Compatibility manifest: ${field}`);
}
assert.equal(pkg.version, plugin.version);
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
assert.equal(pkg.name, plugin.name);
assert.equal(marketplace.plugins[0].name, plugin.name);
assert.equal(legacy.skills, './skills');
assert.equal(legacy.mcpServers, './.mcp.json');
assert.deepEqual(legacy.interface, plugin.extensions['com.openai'].interface);
if (plugin.version !== undefined) assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
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
  assert.ok(!relative(process.cwd(), resolve(path)).startsWith('..'), 'Compatibility path escapes plugin');
  await stat(path);
}
for (const field of ['logo', 'logoDark', 'composerIcon', 'composerIconDark']) {
  assert.ok(typeof ui[field] === 'string' && ui[field].startsWith('./'), `Icon path: ${field}`);
  const path = resolve(ui[field]);
  assert.ok(!relative(process.cwd(), path).startsWith('..'));
  const image = await readFile(path);
  assert.equal(image.subarray(1, 4).toString(), 'PNG');
  assert.equal(image.readUInt32BE(16), image.readUInt32BE(20));
  assert.ok(image.readUInt32BE(16) >= 48 && image.readUInt32BE(16) <= 4096);
  assert.ok(image.length <= 5 * 1024 * 1024);
}
assert.deepEqual((await json('mcp.json')).mcpServers, (await json('.mcp.json')).mcpServers);
assert.deepEqual((await json('mcp.json')).mcpServers.penpot, {
  type: 'stdio', command: 'node', args: ['${PLUGIN_ROOT}/server/bridge.mjs'], cwd: '${PLUGIN_ROOT}'
});
assert.ok((await stat('server/bridge.mjs')).size > 0);
assert.equal((await json('server/build-info.json')).sdk, pkg.dependencies['@modelcontextprotocol/sdk']);
const skills = await readdir('skills');
assert.equal(skills.length, 5);
for (const name of skills) {
  const path = `skills/${name}/SKILL.md`;
  const text = await readFile(path, 'utf8');
  assert.ok(text.startsWith(`---\nname: ${name}\n`) || text.startsWith(`---\r\nname: ${name}\r\n`));
  assert.match(text, /\ndescription: .+/);
  for (const match of text.matchAll(/\]\(([^)]+\.md)\)/g)) {
    await stat(resolve(dirname(path), match[1]));
  }
}
console.log(`Portable package checks passed: ${plugin.name} ${plugin.version ?? '(unreleased)'}, ${skills.length} skills.`);
if (legacy.version === undefined) console.log('Unversioned Codex overlay: release-format compatibility is unverified; see docs/host-compatibility.md.');
process.chdir('..');
