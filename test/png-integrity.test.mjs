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
function encodedPng({ depth = 8, color = 6, compression = 0, filter = 0, interlace = 0,
  raster = Buffer.alloc(48 * (1 + 48 * 4)), before = [], after = [] } = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(48); header.writeUInt32BE(48, 4);
  Buffer.from([depth, color, compression, filter, interlace]).copy(header, 8);
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), ...before,
    chunk('IDAT', deflateSync(raster)), ...after, chunk('IEND', Buffer.alloc(0))]);
}

test('raster length and scanline filter bytes must match IHDR', () => {
  for (const raster of [Buffer.alloc(1), Buffer.alloc(48 * 193 - 1), Buffer.alloc(48 * 193 + 1)]) {
    assert.throws(() => inspectPng(encodedPng({ raster })), /Invalid PNG compressed IDAT stream/);
  }
  const raster = Buffer.alloc(48 * 193); raster[193] = 5;
  assert.throws(() => inspectPng(encodedPng({ raster })), /Invalid PNG compressed IDAT stream/);
});

test('IHDR encoding fields and color-depth combinations are validated', () => {
  for (const options of [{ depth: 4 }, { color: 1 }, { color: 3, depth: 16 },
    { compression: 1 }, { filter: 1 }, { interlace: 2 }]) {
    assert.throws(() => inspectPng(encodedPng(options)), /Invalid PNG IHDR/);
  }
});

test('PLTE cardinality, placement, color type and size are enforced', () => {
  const palette = chunk('PLTE', Buffer.alloc(6));
  const indexed = { color: 3, raster: Buffer.alloc(48 * 49) };
  for (const options of [indexed, { ...indexed, after: [palette] },
    { ...indexed, before: [palette, palette] }, { color: 0, before: [palette] },
    { color: 4, before: [palette] }, { ...indexed, before: [chunk('PLTE', Buffer.alloc(4))] },
    { ...indexed, before: [chunk('PLTE', Buffer.alloc(0))] },
    { ...indexed, before: [chunk('PLTE', Buffer.alloc(771))] },
    { ...indexed, depth: 1, before: [chunk('PLTE', Buffer.alloc(9))] }]) {
    assert.throws(() => inspectPng(encodedPng(options)), /PNG.*PLTE/);
  }
  assert.deepEqual(inspectPng(encodedPng({ ...indexed, before: [palette] })), { width: 48, height: 48 });
});

test('reserved lowercase type byte and unknown critical chunks fail; ancillary chunks pass', () => {
  for (const type of ['abcD', 'ABCD']) {
    assert.throws(() => inspectPng(encodedPng({ before: [chunk(type, Buffer.alloc(0))] })), /PNG chunk type/);
  }
  assert.deepEqual(inspectPng(encodedPng({ before: [chunk('abCD', Buffer.alloc(0))] })), { width: 48, height: 48 });
});

test('all supported color depths and Adam7 passes have exact scanline layouts', () => {
  for (const [color, depths, channels] of [[0, [1, 2, 4, 8, 16], 1], [2, [8, 16], 3],
    [3, [1, 2, 4, 8], 1], [4, [8, 16], 2], [6, [8, 16], 4]]) {
    for (const depth of depths) {
      for (const interlace of [0, 1]) {
        const passes = interlace ? [[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]] : [[0,0,1,1]];
        const bytes = passes.reduce((n, [x,y,dx,dy]) => n + Math.ceil((48-y)/dy) *
          (1 + Math.ceil(Math.ceil((48-x)/dx) * depth * channels / 8)), 0);
        const options = { color, depth, interlace, raster: Buffer.alloc(bytes),
          before: color === 3 ? [chunk('PLTE', Buffer.alloc(6))] : [] };
        assert.deepEqual(inspectPng(encodedPng(options)), { width: 48, height: 48 });
        assert.throws(() => inspectPng(encodedPng({ ...options, raster: Buffer.alloc(bytes - 1) })), /Invalid PNG compressed IDAT stream/);
      }
    }
  }
});
