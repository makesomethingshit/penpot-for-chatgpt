import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
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

function chunk(type, data) {
  const bytes = Buffer.alloc(data.length + 12);
  bytes.writeUInt32BE(data.length);
  Buffer.from(type, 'latin1').copy(bytes, 4);
  data.copy(bytes, 8);
  let crc = 0xffffffff;
  for (const byte of bytes.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  bytes.writeUInt32BE((crc ^ 0xffffffff) >>> 0, bytes.length - 4);
  return bytes;
}
function png(width, height, payload, type = 'IHDR') {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4);
  header[8] = 16; header[9] = 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk(type, header),
    chunk('IDAT', payload), chunk('IEND', Buffer.alloc(0))]);
}

test('IDAT rejects trailing garbage and a second zlib stream despite valid chunk CRC', () => {
  const stream = deflateSync(Buffer.alloc(48 * (1 + 48 * 8)));
  for (const extra of [Buffer.from('garbage'), stream]) {
    assert.throws(() => inspectPng(png(48, 48, Buffer.concat([stream, extra]))), /Invalid PNG compressed IDAT stream/);
  }
});

test('raw high-bit chunk type bytes cannot masquerade as IHDR', () => {
  assert.throws(() => inspectPng(png(48, 48, deflateSync(Buffer.alloc(48 * (1 + 48 * 8))), '\xc9HDR')),
    /Invalid PNG chunk type/);
});

test('maximum-size 16-bit RGBA icon fits the bounded inflate limit', () => {
  const image = png(4096, 4096, deflateSync(Buffer.alloc(4096 * (1 + 4096 * 8))));
  assert.deepEqual(inspectPng(image), { width: 4096, height: 4096 });
});
