// Canonical JSON serialization for hash-chaining (SPEC-004 §6, one-way-door
// audit finding 1). RFC 8785 (JCS) subset sufficient for our receipt objects:
// object keys sorted lexicographically, no insignificant whitespace, strings
// JSON-escaped, integers as-is. Two implementations MUST produce identical
// bytes for the same receipt — that is what makes a cross-language hash chain
// verifiable. We deliberately restrict receipt fields to strings and safe
// integers (no floats) so serialization is unambiguous.

function canonicalize(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error(`canonical: only finite integers allowed, got ${value}`);
    }
    return String(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return (
      '{' +
      keys
        .map((k) => JSON.stringify(k) + ':' + canonicalize(value[k]))
        .join(',') +
      '}'
    );
  }
  throw new Error(`canonical: unsupported type ${typeof value}`);
}

export { canonicalize };
