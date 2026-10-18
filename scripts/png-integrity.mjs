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
  const idat = [];

  while (offset < image.length) {
    assert.ok(offset + 12 <= image.length, 'Truncated PNG chunk header');
    const length = image.readUInt32BE(offset);
    const end = offset + 12 + length;
    assert.ok(end <= image.length, 'Truncated PNG chunk payload');
    const type = image.toString('ascii', offset + 4, offset + 8);
    assert.match(type, /^[A-Za-z]{4}$/, 'Invalid PNG chunk type');
    assert.equal(image.readUInt32BE(end - 4), crc32(image, offset + 4, end - 4),
      `PNG chunk CRC mismatch: ${type}`);

    if (first) {
      assert.equal(type, 'IHDR', 'PNG must begin with IHDR');
      assert.equal(length, 13, 'Invalid PNG IHDR length');
      width = image.readUInt32BE(offset + 8);
      height = image.readUInt32BE(offset + 12);
    } else {
      assert.notEqual(type, 'IHDR', 'PNG has duplicate IHDR');
    }

    if (type === 'IDAT') {
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
    assert.ok(inflateSync(Buffer.concat(idat), { maxOutputLength: 128 * 1024 * 1024 }).length > 0);
  } catch (error) {
    throw new Error('Invalid PNG compressed IDAT stream', { cause: error });
  }
  return { width, height };
}
