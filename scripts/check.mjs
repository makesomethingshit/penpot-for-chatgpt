import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';

const json = async path => JSON.parse(await readFile(path, 'utf8'));
const pkg = await json('package.json');
const marketplace = await json('.agents/plugins/marketplace.json');
assert.equal(marketplace.plugins.length, 1);
assert.equal(marketplace.plugins[0].source.path, './plugin');
process.chdir('plugin');
const plugin = await json('plugin.json');
const legacy = await json('.codex-plugin/plugin.json');
for (const field of ['name', 'version', 'description', 'author', 'keywords']) {
  assert.deepEqual(legacy[field], plugin[field], `Compatibility manifest: ${field}`);
}
assert.equal(pkg.version, plugin.version);
assert.equal(pkg.name, plugin.name);
assert.deepEqual(legacy.interface, plugin.extensions['com.openai'].interface);
assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
const ui = legacy.interface;
assert.ok([...ui.shortDescription].length <= 30);
for (const field of ['logo', 'logoDark', 'composerIcon', 'composerIconDark']) {
  const path = resolve(ui[field]);
  assert.ok(!relative(process.cwd(), path).startsWith('..'));
  const image = await readFile(path);
  assert.equal(image.subarray(1, 4).toString(), 'PNG');
  assert.equal(image.readUInt32BE(16), image.readUInt32BE(20));
  assert.ok(image.readUInt32BE(16) >= 48 && image.readUInt32BE(16) <= 4096);
  assert.ok(image.length <= 5 * 1024 * 1024);
}
assert.deepEqual((await json('mcp.json')).mcpServers, (await json('.mcp.json')).mcpServers);
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
console.log(`Package valid: ${plugin.name} ${plugin.version}, ${skills.length} skills.`);
process.chdir('..');
