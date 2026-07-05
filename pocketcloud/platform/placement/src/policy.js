// Anti-collusion attributes, pool policy, and the NON-RELAXABLE floor.
//
// Master PRD §8.4 anti-collusion placement policy: for a job needing n
// distinct share indices, no two distinct share indices may be placed on
// devices that share ANY of {owner account, payout account, public IP /24,
// ASN+city, hardware-fingerprint cluster}. Redundant replicas of the SAME
// share index MAY share attributes — colluding copies of one share learn
// nothing new.
//
// We model each constraint as a per-attribute cap: the maximum number of
// DISTINCT share indices of a single job that may co-locate within one group
// value of that attribute. The strict public policy is "1 everywhere": every
// owner / payout / /24 / ASN+city / fingerprint cluster holds at most one
// distinct share index.
//
// A private pool (PRD §5.0, F19; CP-014) may RELAX some of these caps —
// because inside one organisation's MDM-managed fleet the whole point is that
// the org owns every device (shared owner), often behind one egress (shared
// /24, shared ASN+city) and one billing/showback account (shared payout).
// If those stayed pinned at 1, a private pool could never place more than one
// share, which is absurd. So owner / payout / /24 / ASN+city are RELAXABLE.
//
// The floor (CP-015, SEC-001 gap 1) is the part NO policy can move:
//   F-a. distinct physical device — a device serves at most ONE share index
//        of a job (enforced structurally: one slot per device).
//   F-b. the hardware-fingerprint cluster cap can NEVER be relaxed, and is
//        additionally clamped below the job's collusion threshold t.
//
// Why the fingerprint cluster is the floor axis: the SEC-001 gap-1 adversary
// holds a leaked org enrollment token and enrols ROGUE devices into the pool
// to collect >= t shares of one job. Owner / payout / network are exactly the
// attributes that adversary can make look legitimate (they claim the org's
// identity, sit behind the org's NAT). What a Sybil fleet CANNOT cheaply
// diversify — and what a fleet of genuinely distinct corporate machines does
// NOT share — is the hardware-fingerprint cluster (VMs cloned from one image,
// a botnet build, many identities on one physical host all cluster). So the
// floor keys on the fingerprint cluster. This assumes honest fingerprinting;
// producing that signal is HA-005's job (attestation), out of scope here, and
// stated as an explicit dependency.

// Attribute keys, in a fixed order (stable for diagnostics / transparency log).
export const ATTRS = [
  'ownerAccount',
  'payoutAccount',
  'ip24',
  'asnCity',
  'hwFingerprintCluster',
];

// Attributes a pool policy is permitted to relax.
export const RELAXABLE_ATTRS = new Set([
  'ownerAccount',
  'payoutAccount',
  'ip24',
  'asnCity',
]);

// Attributes NO policy may relax. hwFingerprintCluster is the collusion-
// capable identity the floor protects; the per-device rule (F-a) is enforced
// structurally in the solver and is not an entry here.
export const FLOOR_ATTRS = new Set(['hwFingerprintCluster']);

// Derive the anti-collusion attribute group values for a device. A device may
// supply `ip24` directly or a full `ip` we reduce to its /24; likewise an
// `asnCity` directly or separate `asn` + `city`. Missing attributes throw —
// an unattributed device cannot be safely placed (fail closed, Standards §4).
export function deviceAttrs(device) {
  const ip24 = device.ip24 ?? ipToSlash24(device.ip);
  const asnCity =
    device.asnCity ??
    (device.asn != null && device.city != null
      ? `${device.asn}|${device.city}`
      : undefined);

  const attrs = {
    ownerAccount: device.ownerAccount,
    payoutAccount: device.payoutAccount,
    ip24,
    asnCity,
    hwFingerprintCluster: device.hwFingerprintCluster,
  };

  for (const key of ATTRS) {
    if (attrs[key] === undefined || attrs[key] === null || attrs[key] === '') {
      throw new PlacementError(
        `device ${describeDevice(device)} is missing anti-collusion attribute '${key}'; ` +
          `unattributed devices cannot be placed (fail closed)`,
        'unattributed-device',
      );
    }
  }
  return attrs;
}

function ipToSlash24(ip) {
  if (typeof ip !== 'string') return undefined;
  const parts = ip.split('.');
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p))) {
    return undefined;
  }
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

function describeDevice(device) {
  return device && device.id != null ? String(device.id) : '<no id>';
}

// A typed error so callers can distinguish "you asked for something
// impossible / malformed" (400-class) from a programming fault.
export class PlacementError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'PlacementError';
    this.code = code ?? 'placement-error';
    this.status = 400;
  }
}

// A floor violation is a DIFFERENT class of event: it means the solver (or a
// caller-supplied placement) broke an invariant that is supposed to be
// impossible by construction. It is a security defect, not a bad request.
export class PlacementFloorViolation extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'PlacementFloorViolation';
    this.code = 'floor-violation';
    this.status = 500;
    this.detail = detail;
  }
}

// Compute the effective per-attribute distinct-share cap for a job, given its
// (validated) pool policy and collusion threshold t.
//
//   - relaxable attribute, no relax entry  -> 1 (strict public default)
//   - relaxable attribute, relax = k        -> k   (k a positive integer)
//   - relaxable attribute, relax = 'any'    -> +Infinity
//   - floor attribute (fingerprint)         -> min(1 baseline, t-1); pinned,
//                                              never taken from policy
//
// The floor attribute is additionally clamped to t-1 so that a single
// fingerprint cluster can hold at most t-1 distinct share indices — strictly
// fewer than the t needed to reconstruct. With the baseline of 1 and t >= 2,
// min(1, t-1) = 1, i.e. the cluster is unique in the shipped configuration;
// the explicit clamp is the belt-and-suspenders guarantee that even a future
// relaxation of the baseline can never reach t.
export function effectiveLimits(policy, threshold) {
  const limits = {};
  for (const attr of ATTRS) {
    if (FLOOR_ATTRS.has(attr)) {
      limits[attr] = Math.min(1, threshold - 1);
      continue;
    }
    const relax = policy?.relax?.[attr];
    if (relax === undefined) {
      limits[attr] = 1;
    } else if (relax === 'any') {
      limits[attr] = Infinity;
    } else {
      limits[attr] = relax;
    }
  }
  return limits;
}

// Validate a pool policy in isolation: it must target a concrete pool, and it
// must NOT attempt to relax a floor attribute (that attempt is rejected
// loudly rather than silently ignored — a policy author who tries to loosen
// the fingerprint constraint has made a security-relevant mistake).
export function validatePolicy(policy) {
  if (policy == null) return null;
  if (typeof policy !== 'object') {
    throw new PlacementError('policy must be an object or null', 'bad-policy');
  }
  if (policy.poolId == null) {
    throw new PlacementError(
      'pool policy must name the poolId it applies to',
      'bad-policy',
    );
  }
  const relax = policy.relax ?? {};
  for (const [attr, value] of Object.entries(relax)) {
    if (!ATTRS.includes(attr)) {
      throw new PlacementError(
        `policy relaxes unknown attribute '${attr}'`,
        'bad-policy',
      );
    }
    if (FLOOR_ATTRS.has(attr) || !RELAXABLE_ATTRS.has(attr)) {
      throw new PlacementError(
        `policy may not relax the non-relaxable floor attribute '${attr}' ` +
          `(SEC-001 gap 1: the anti-collusion floor is not a policy knob)`,
        'floor-not-relaxable',
      );
    }
    if (value !== 'any' && !(Number.isInteger(value) && value >= 1)) {
      throw new PlacementError(
        `policy relax for '${attr}' must be a positive integer or 'any', got ${JSON.stringify(value)}`,
        'bad-policy',
      );
    }
  }
  return policy;
}
