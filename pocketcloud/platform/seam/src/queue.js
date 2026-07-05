// At-least-once delivery queue with bounded retry + DLQ (SEAMS S2/S3).
//
// Models the Cloudflare Queue between the producer (CP-013) and the Postgres
// consumer (MB-013). Delivery may retry; the consumer must be idempotent
// (which it is — ON CONFLICT DO NOTHING). A message that fails `maxAttempts`
// times lands in the DLQ with an alert hook, never silently dropped (S3).

export function inMemoryQueue({ maxAttempts = 5 } = {}) {
  const ready = []; // { body, attempts }
  const dlq = [];
  let onDlq = null;

  return {
    enqueue(body) {
      ready.push({ body, attempts: 0 });
    },
    depth: () => ready.length,
    dlqDepth: () => dlq.length,
    onDeadLetter(fn) {
      onDlq = fn;
    },
    // Drain: hand each ready message to `handler(body)`. If the handler throws
    // (e.g. Postgres is down), the message is retried (re-queued) up to
    // maxAttempts, then dead-lettered. Returns counts. At-least-once: a handler
    // that succeeds after a partial effect must be idempotent.
    async drain(handler) {
      let delivered = 0;
      let retried = 0;
      let deadLettered = 0;
      // snapshot to avoid infinite loop when a handler re-enqueues on failure
      const batch = ready.splice(0, ready.length);
      for (const msg of batch) {
        try {
          await handler(msg.body);
          delivered += 1;
        } catch (err) {
          msg.attempts += 1;
          if (msg.attempts >= maxAttempts) {
            dlq.push({ body: msg.body, attempts: msg.attempts, error: String(err && err.message) });
            deadLettered += 1;
            if (onDlq) onDlq(msg.body, err);
          } else {
            ready.push(msg); // retry on the next drain (backoff modeled by caller)
            retried += 1;
          }
        }
      }
      return { delivered, retried, deadLettered };
    },
    dlq: () => dlq.slice(),
  };
}
