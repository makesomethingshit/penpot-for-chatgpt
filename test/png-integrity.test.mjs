import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { inspectPng } from '../scripts/png-integrity.mjs';

const iconPaths = ['plugin/assets/icon.png', 'plugin/assets/icon-dark.png'];

test('shipped icon PNGs have valid chunks, CRCs and inflateable IDAT', async () => {
  for (const path of iconPaths) {
    const image = await readFile(path);
    const { width, height } = inspectPng(image);
    assert.equal(width, height, path);
    assert.ok(width >= 48 && width <= 4096, path);
  }
});

test('a flipped IDAT byte fails the PNG integrity check', async () => {
  const image = Buffer.from(await readFile(iconPaths[0]));
  const idatOffset = image.indexOf(Buffer.from('IDAT'));
  assert.ok(idatOffset > 0, 'Expected an IDAT chunk in the icon fixture');
  image[idatOffset + 4] ^= 0x40;
  assert.throws(() => inspectPng(image), /PNG chunk CRC mismatch: IDAT/);
});

test('truncated PNG and bytes after IEND are rejected', async () => {
  const image = await readFile(iconPaths[0]);
  assert.throws(() => inspectPng(image.subarray(0, image.length - 5)), /Truncated PNG chunk/);
  const trailer = Buffer.concat([image, Buffer.from('unexpected data')]);
  assert.throws(() => inspectPng(trailer), /Unexpected bytes after PNG IEND/);
});

test('PNG signature corruption is rejected', async () => {
  const image = Buffer.from(await readFile(iconPaths[1]));
  image[0] ^= 0xff;
  assert.throws(() => inspectPng(image), /Invalid PNG signature/);
});
