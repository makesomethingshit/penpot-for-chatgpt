import assert from 'node:assert/strict';
import test from 'node:test';
import { isReleaseVersion } from '../scripts/release-version.mjs';

test('release version checker accepts stable and SemVer prerelease identifiers', () => {
  for (const version of [
    '0.1.0-rc.1', '0.1.0', '1.0.0', '1.0.0-rc.1+build.21',
    '1.2.3-alpha.beta', '1.2.3-0', '3.0.0+build.1'
  ]) assert.equal(isReleaseVersion(version), true, version);
});

test('release version checker rejects invalid and noncanonical SemVer', () => {
  for (const version of [
    '', '1', '1.0', 'v1.0.0', '01.0.0', '1.02.3', '1.2.03',
    '1.0.0-rc.01', '1.0.0-00', '1.0.0-',
    '1.0.0+', '1.0.0-rc..1', '1.0.0+build..1',
    '1.0.0-rc_1', '1.0.0+build/1', null, 1
  ]) assert.equal(isReleaseVersion(version), false, String(version));
});
