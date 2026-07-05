// The R2 append-only, hash-chained receipt log — the FINANCIAL SOURCE OF TRUTH
// (SEAMS §4, SPEC-004 §6). Postgres is a projection of this; this is never a
// projection of Postgres.
//
// Receipts are partitioned by day/cell. Within a partition they form a hash
// chain (each entry's prevHash = the prior entry's hash). Partitions are
// anchored: a partition's genesis entry carries the prior partition's head
// hash, so the whole history is ONE verifiable chain, not islands (one-way-door
// audit finding 1 / SPEC-004 §6.4).
//
// Two backends: InMemoryR2Log (fast tests) and FilesystemR2Log (a faithful
// stand-in for R2 object storage — NDJSON objects on disk). Production swaps in
// an R2 client with the identical interface. Canonical hashing is shared with
// the ledger so hashes are cross-component identical.

import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { canonicalize } from '../../ledger/canonical.js';

export const GENESIS = '0'.repeat(64);

export function hashReceipt(bodyWithoutHash) {
  return createHash('sha256').update(canonicalize(bodyWithoutHash), 'utf8').digest('hex');
}

// Compute the chain-hash of a receipt body: everything except `hash` itself,
// including prevHash. Deterministic and canonical (RFC 8785 subset).
export function sealReceipt(body) {
  const { hash, ...rest } = body;
  return { ...rest, hash: hashReceipt(rest) };
}

// ---- In-memory backend -----------------------------------------------------
export function inMemoryR2Log() {
  const partitions = new Map(); // partitionKey -> { entries: [], head }
  const order = []; // partition keys in creation order (for anchoring)

  function partition(key) {
    let p = partitions.get(key);
    if (!p) {
      p = { entries: [], head: null };
      partitions.set(key, p);
      order.push(key);
    }
    return p;
  }

  // Prior partition head, for genesis anchoring.
  function priorHead(key) {
    const idx = order.indexOf(key);
    for (let i = idx - 1; i >= 0; i--) {
      const p = partitions.get(order[i]);
      if (p.head) return p.head;
    }
    return GENESIS;
  }

  return {
    // Append a receipt body (without prevHash/hash) to a partition; the log
    // assigns prevHash + hash and returns the sealed receipt. Idempotent on
    // receiptId within a partition (re-append returns the existing entry).
    append(partitionKey, receiptBody) {
      const p = partition(partitionKey);
      const existing = p.entries.find((e) => e.receiptId === receiptBody.receiptId);
      if (existing) return existing;
      const prevHash = p.head ?? priorHead(partitionKey);
      const sealed = sealReceipt({ ...receiptBody, prevHash });
      p.entries.push(sealed);
      p.head = sealed.hash;
      return sealed;
    },
    partitions: () => order.slice(),
    read: (partitionKey) => (partitions.get(partitionKey)?.entries ?? []).slice(),
    // All receipts across partitions in chain order.
    readAll() {
      const out = [];
      for (const key of order) out.push(...partitions.get(key).entries);
      return out;
    },
    head: (partitionKey) => partitions.get(partitionKey)?.head ?? GENESIS,
  };
}

// ---- Filesystem backend (faithful R2 stand-in) -----------------------------
// R2 object keys legitimately contain '/'; on a filesystem that would create
// subdirectories, so we reversibly encode the key into a flat filename. The
// log's logical partition keys are unchanged.
export function filesystemR2Log(dir) {
  mkdirSync(dir, { recursive: true });
  const encode = (key) => encodeURIComponent(key);
  const decode = (name) => decodeURIComponent(name);
  const headFor = (key) => {
    const entries = readPartition(key);
    return entries.length ? entries[entries.length - 1].hash : null;
  };
  const listPartitions = () =>
    existsSync(dir)
      ? readdirSync(dir).filter((f) => f.endsWith('.ndjson')).map((f) => decode(f.replace(/\.ndjson$/, ''))).sort()
      : [];
  const readPartition = (key) => {
    const path = join(dir, `${encode(key)}.ndjson`);
    if (!existsSync(path)) return [];
    return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  };
  const priorHead = (key) => {
    const parts = listPartitions();
    const idx = parts.indexOf(key);
    for (let i = idx - 1; i >= 0; i--) {
      const h = headFor(parts[i]);
      if (h) return h;
    }
    return GENESIS;
  };

  return {
    append(partitionKey, receiptBody) {
      const entries = readPartition(partitionKey);
      const existing = entries.find((e) => e.receiptId === receiptBody.receiptId);
      if (existing) return existing;
      const prevHash = entries.length ? entries[entries.length - 1].hash : priorHead(partitionKey);
      const sealed = sealReceipt({ ...receiptBody, prevHash });
      appendFileSync(join(dir, `${encode(partitionKey)}.ndjson`), JSON.stringify(sealed) + '\n');
      return sealed;
    },
    partitions: listPartitions,
    read: readPartition,
    readAll() {
      const out = [];
      for (const key of listPartitions()) out.push(...readPartition(key));
      return out;
    },
    head: (key) => headFor(key) ?? GENESIS,
  };
}

// Verify the full hash chain across partitions (SEAMS §4 / audit finding 1).
// Returns { ok, brokenAt?, reason? }.
export function verifyChain(log) {
  let expectedPrev = GENESIS;
  for (const key of log.partitions()) {
    for (const e of log.read(key)) {
      if (e.prevHash !== expectedPrev) {
        return { ok: false, brokenAt: e.receiptId, reason: 'prevHash mismatch (reorder/gap)' };
      }
      if (hashReceipt(strip(e)) !== e.hash) {
        return { ok: false, brokenAt: e.receiptId, reason: 'hash mismatch (record altered)' };
      }
      expectedPrev = e.hash;
    }
  }
  return { ok: true, head: expectedPrev };
}

function strip(entry) {
  const { hash, ...rest } = entry;
  return rest;
}
