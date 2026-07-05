// JSON transport helpers. Field elements are BigInt, which JSON cannot
// carry, so shares travel as decimal strings.

import { mod } from '../crypto/field.js';

export const f2s = (v) => v.toString();
export const s2f = (s) => mod(BigInt(s));

export const vec2s = (vs) => vs.map(f2s);
export const s2vec = (ss) => ss.map(s2f);

export const mat2s = (rows) => rows.map(vec2s);
export const s2mat = (rows) => rows.map(s2vec);

export function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}
