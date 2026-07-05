// Org enrollment token lifecycle (CP-015 / SEC-001 gap 1, key K10).
//
// A private pool is bootstrapped with org enrollment tokens handed to an MDM
// system (Intune/Jamf/RMM) so devices join the pool with no per-device
// interaction (F20). The SEC-001 gap-1 adversary's entry point is a LEAKED
// token: if a token can be reused, or lives too long, or isn't bound to a
// specific pool, the attacker enrols rogue devices into the pool and then
// races to collect >= t shares of a job. The placement floor (placement.js)
// is the second line of defence; this module is the first: it makes a token
//   - single-use   (usedAt set on first consume; a second consume is rejected)
//   - short-lived  (issued with expiry <= MAX_TOKEN_LIFETIME_MS; K10: <= 72h)
//   - pool-bound   (carries poolId; validated against the pool being joined)
//
// Time is DETERMINISTIC and passed in as `now` (ms since epoch). The module
// never reads the wall clock — placement and enrollment decisions must be
// replayable (transparency log) and testable without faking Date.
//
// Token shape: { id, poolId, expiresAt, usedAt }
//   id        opaque unique string (a hash/handle; the secret itself is never
//             stored — K10 says "hashed at rest server-side")
//   poolId    the pool this token enrols into
//   expiresAt ms epoch; token invalid at/after this instant
//   usedAt    ms epoch of first use, or null if unused

export const HOUR_MS = 60 * 60 * 1000;
// K10: org enrollment tokens are short-lived (<= 72h).
export const MAX_TOKEN_LIFETIME_MS = 72 * HOUR_MS;

export class EnrollmentError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'EnrollmentError';
    this.code = code ?? 'enrollment-error';
    this.status = 400;
  }
}

// Issue a token. Enforces the K10 max lifetime at ISSUE time so an
// over-long-lived token cannot be minted in the first place.
export function issueEnrollmentToken({ id, poolId, issuedAt, lifetimeMs }) {
  if (!id || typeof id !== 'string') {
    throw new EnrollmentError('token id must be a non-empty string', 'bad-token');
  }
  if (poolId == null || String(poolId).length === 0) {
    throw new EnrollmentError(
      'enrollment token must be bound to a poolId',
      'bad-token',
    );
  }
  if (!Number.isFinite(issuedAt)) {
    throw new EnrollmentError('issuedAt must be a finite ms timestamp', 'bad-token');
  }
  const life = lifetimeMs ?? MAX_TOKEN_LIFETIME_MS;
  if (!Number.isFinite(life) || life <= 0) {
    throw new EnrollmentError('lifetimeMs must be a positive number', 'bad-token');
  }
  if (life > MAX_TOKEN_LIFETIME_MS) {
    throw new EnrollmentError(
      `enrollment token lifetime ${life}ms exceeds K10 maximum ${MAX_TOKEN_LIFETIME_MS}ms (72h)`,
      'lifetime-too-long',
    );
  }
  return {
    id: String(id),
    poolId: String(poolId),
    expiresAt: issuedAt + life,
    usedAt: null,
  };
}

/**
 * Validate a token for enrolling a device into `poolId` at time `now`.
 * Pure: does not mutate. Returns { ok:true } or { ok:false, reason, code }.
 * A device enrolling into a pool MUST pass this before it becomes eligible
 * supply for that pool.
 */
export function validateEnrollmentToken(token, poolId, now) {
  if (token == null || typeof token !== 'object') {
    return fail('token missing or malformed', 'bad-token');
  }
  if (!Number.isFinite(now)) {
    return fail('now must be a finite ms timestamp', 'bad-time');
  }
  if (token.poolId == null) {
    return fail('token is not bound to any pool', 'unbound-token');
  }
  if (String(token.poolId) !== String(poolId)) {
    return fail(
      `token is bound to pool '${token.poolId}', not '${poolId}' ` +
        `(cross-pool enrollment refused)`,
      'wrong-pool',
    );
  }
  if (token.usedAt != null) {
    return fail(
      `token already used at ${token.usedAt} (single-use; reuse refused — ` +
        `possible leaked-token replay, SEC-001 gap 1)`,
      'already-used',
    );
  }
  if (!Number.isFinite(token.expiresAt)) {
    return fail('token has no valid expiry', 'bad-token');
  }
  if (now >= token.expiresAt) {
    return fail(
      `token expired at ${token.expiresAt}, now ${now}`,
      'expired',
    );
  }
  return { ok: true };
}

/**
 * Consume a token (single-use). Validates first, then returns a NEW token
 * object with usedAt = now. Immutable style: the caller persists the returned
 * object; the original is unchanged. Throws EnrollmentError if invalid, so a
 * reused/expired/cross-pool token can never be consumed.
 */
export function consumeEnrollmentToken(token, poolId, now) {
  const v = validateEnrollmentToken(token, poolId, now);
  if (!v.ok) {
    throw new EnrollmentError(v.reason, v.code);
  }
  return { ...token, usedAt: now };
}

function fail(reason, code) {
  return { ok: false, reason, code };
}
