import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';

const signature = Buffer.from('89504e470d0a1a0a', 'hex');

function crc32(bytes, start, end) {
  let crc = 0xffffffff;
  for (let index = start; index < end; index++) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Validate packaged icon PNGs, not arbitrary untrusted image uploads.
export function inspectPng(image) {
  assert.ok(Buffer.isBuffer(image), 'PNG input must be a Buffer');
  assert.ok(image.length >= 57 && image.length <= 5 * 1024 * 1024, 'Invalid PNG icon size');
  assert.ok(image.subarray(0, 8).equals(signature), 'Invalid PNG signature');

  let offset = 8;
  let first = true;
  let sawIEND = false;
  let afterIDAT = false;
  let width;
  let height;
  let depth;
  let color;
  let interlace;
  let sawPLTE = false;
  const idat = [];

  while (offset < image.length) {
    assert.ok(offset + 12 <= image.length, 'Truncated PNG chunk header');
    const length = image.readUInt32BE(offset);
    const end = offset + 12 + length;
    assert.ok(end <= image.length, 'Truncated PNG chunk payload');
    const type = image.toString('latin1', offset + 4, offset + 8);
    assert.match(type, /^[A-Za-z]{2}[A-Z][A-Za-z]$/, 'Invalid PNG chunk type');
    assert.ok(type[0] >= 'a' || ['IHDR', 'PLTE', 'IDAT', 'IEND'].includes(type),
      `Unsupported critical PNG chunk type: ${type}`);
    assert.equal(image.readUInt32BE(end - 4), crc32(image, offset + 4, end - 4),
      `PNG chunk CRC mismatch: ${type}`);

    if (first) {
      assert.equal(type, 'IHDR', 'PNG must begin with IHDR');
      assert.equal(length, 13, 'Invalid PNG IHDR length');
      width = image.readUInt32BE(offset + 8);
      height = image.readUInt32BE(offset + 12);
      assert.ok(width >= 48 && width <= 4096 && height >= 48 && height <= 4096,
        'Invalid PNG icon dimensions');
      depth = image[offset + 16];
      color = image[offset + 17];
      interlace = image[offset + 20];
      const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      assert.ok(depths[color]?.includes(depth), 'Invalid PNG IHDR color/bit depth');
      assert.ok(image[offset + 18] === 0 && image[offset + 19] === 0 && interlace <= 1,
        'Invalid PNG IHDR encoding method');
    } else {
      assert.notEqual(type, 'IHDR', 'PNG has duplicate IHDR');
    }

    if (type === 'PLTE') {
      assert.ok(!sawPLTE && idat.length === 0 && color !== 0 && color !== 4,
        'Invalid PNG PLTE placement or color type');
      assert.ok(length > 0 && length % 3 === 0 && length <= 768 &&
        (color !== 3 || length / 3 <= 2 ** depth), 'Invalid PNG PLTE size');
      sawPLTE = true;
    }
    if (type === 'IDAT') {
      assert.ok(color !== 3 || sawPLTE, 'Indexed PNG requires PLTE before IDAT');
      assert.ok(!afterIDAT, 'PNG IDAT chunks must be consecutive');
      idat.push(image.subarray(offset + 8, end - 4));
    } else if (idat.length > 0) {
      afterIDAT = true;
    }

    if (type === 'IEND') {
      assert.equal(length, 0, 'Invalid PNG IEND length');
      assert.ok(idat.length > 0, 'PNG has no IDAT');
      assert.equal(end, image.length, 'Unexpected bytes after PNG IEND');
      sawIEND = true;
    }
    first = false;
    offset = end;
  }

  assert.ok(sawIEND, 'Missing PNG IEND');
  assert.ok(idat.length > 0 && idat.some(part => part.length > 0), 'Empty PNG IDAT');
  try {
    const compressed = Buffer.concat(idat);
    const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
    const passes = interlace === 0 ? [[0, 0, 1, 1]] :
      [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4],
        [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];
    const layouts = passes.map(([x, y, dx, dy]) => ({
      rows: Math.ceil((height - y) / dy),
      stride: 1 + Math.ceil(Math.ceil((width - x) / dx) * channels * depth / 8)
    }));
    const expected = layouts.reduce((size, { rows, stride }) => size + rows * stride, 0);
    const { buffer, engine } = inflateSync(compressed, { maxOutputLength: expected, info: true });
    assert.equal(buffer.length, expected, 'PNG raster length does not match IHDR');
    let position = 0;
    for (const { rows, stride } of layouts) {
      for (let row = 0; row < rows; row++, position += stride) {
        assert.ok(buffer[position] <= 4, 'Invalid PNG scanline filter');
      }
    }
    assert.equal(engine.bytesWritten, compressed.length, 'Trailing bytes in PNG IDAT stream');
  } catch (error) {
    throw new Error('Invalid PNG compressed IDAT stream', { cause: error });
  }
  return { width, height };
}
