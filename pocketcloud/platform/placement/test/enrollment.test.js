// Enrollment-token lifecycle (CP-015 / K10 / SEC-001 gap 1): single-use,
// short-lived, pool-bound. Deterministic time passed in.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  issueEnrollmentToken,
  validateEnrollmentToken,
  consumeEnrollmentToken,
  EnrollmentError,
  MAX_TOKEN_LIFETIME_MS,
  HOUR_MS,
} from '../index.js';

const T0 = 1_000_000_000_000; // fixed base time (ms)

function freshToken(overrides = {}) {
  return issueEnrollmentToken({
    id: 'tok-1',
    poolId: 'pool-A',
    issuedAt: T0,
    lifetimeMs: 24 * HOUR_MS,
    ...overrides,
  });
}

test('a fresh, unexpired, pool-matched token validates', () => {
  const tok = freshToken();
  assert.deepEqual(validateEnrollmentToken(tok, 'pool-A', T0 + HOUR_MS), {
    ok: true,
  });
});

test('token bound to a different pool is refused (cross-pool)', () => {
  const tok = freshToken();
  const r = validateEnrollmentToken(tok, 'pool-B', T0 + HOUR_MS);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'wrong-pool');
});

test('expired token is refused', () => {
  const tok = freshToken({ lifetimeMs: HOUR_MS });
  const r = validateEnrollmentToken(tok, 'pool-A', T0 + HOUR_MS); // exactly at expiry
  assert.equal(r.ok, false);
  assert.equal(r.code, 'expired');

  const r2 = validateEnrollmentToken(tok, 'pool-A', T0 + 2 * HOUR_MS);
  assert.equal(r2.ok, false);
  assert.equal(r2.code, 'expired');
});

test('single-use: a consumed token cannot be reused (leaked-token replay)', () => {
  const tok = freshToken();
  const used = consumeEnrollmentToken(tok, 'pool-A', T0 + HOUR_MS);
  assert.equal(used.usedAt, T0 + HOUR_MS);

  // Original object is unchanged (immutable style).
  assert.equal(tok.usedAt, null);

  // The used token no longer validates.
  const r = validateEnrollmentToken(used, 'pool-A', T0 + 2 * HOUR_MS);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'already-used');

  // And consuming it again throws.
  assert.throws(
    () => consumeEnrollmentToken(used, 'pool-A', T0 + 2 * HOUR_MS),
    (e) => e instanceof EnrollmentError && e.code === 'already-used',
  );
});

test('consume refuses an expired or cross-pool token', () => {
  const expired = freshToken({ lifetimeMs: HOUR_MS });
  assert.throws(
    () => consumeEnrollmentToken(expired, 'pool-A', T0 + 2 * HOUR_MS),
    (e) => e instanceof EnrollmentError && e.code === 'expired',
  );
  const tok = freshToken();
  assert.throws(
    () => consumeEnrollmentToken(tok, 'pool-B', T0 + HOUR_MS),
    (e) => e instanceof EnrollmentError && e.code === 'wrong-pool',
  );
});

test('issuing a token longer-lived than the K10 max is refused', () => {
  assert.throws(
    () =>
      issueEnrollmentToken({
        id: 'x',
        poolId: 'pool-A',
        issuedAt: T0,
        lifetimeMs: MAX_TOKEN_LIFETIME_MS + 1,
      }),
    (e) => e instanceof EnrollmentError && e.code === 'lifetime-too-long',
  );
});

test('issuing requires an id, a poolId, and a finite issuedAt', () => {
  assert.throws(() => issueEnrollmentToken({ poolId: 'p', issuedAt: T0 }), /token id/);
  assert.throws(() => issueEnrollmentToken({ id: 'x', issuedAt: T0 }), /bound to a poolId/);
  assert.throws(
    () => issueEnrollmentToken({ id: 'x', poolId: 'p', issuedAt: NaN }),
    /issuedAt/,
  );
});

test('malformed token and non-finite time are refused, not thrown, by validate', () => {
  assert.equal(validateEnrollmentToken(null, 'p', T0).ok, false);
  assert.equal(validateEnrollmentToken({}, 'p', T0).code, 'unbound-token');
  assert.equal(
    validateEnrollmentToken(freshToken(), 'pool-A', NaN).code,
    'bad-time',
  );
});
