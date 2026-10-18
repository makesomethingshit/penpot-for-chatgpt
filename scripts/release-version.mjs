// Semantic Versioning 2.0.0: stable, prerelease and build metadata.
// Numeric prerelease identifiers may not have leading zeroes.
export function isReleaseVersion(value) {
  if (typeof value !== 'string') return false;
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(value);
  if (!match) return false;
  return match[4] === undefined || match[4].split('.').every(id =>
    !/^\d+$/.test(id) || id === '0' || !id.startsWith('0')
  );
}
