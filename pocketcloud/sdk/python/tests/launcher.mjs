// Test-only launcher: boots a real PoC coordinator + N workers in-process and
// prints the coordinator URL as one line of JSON on stdout, then stays alive
// until it receives SIGTERM/SIGINT. The pytest fixture (conftest.py) spawns
// this as a subprocess and reads the URL from that line.
//
// It ADDS no behavior to the PoC — it only imports and wires the existing
// createCoordinator / createWorker (Standards §7.2: no scope creep into the
// coordinator or crypto). Config via env:
//   PC_WORKERS   total worker count (default 5)
//   PC_TAMPER    how many of them tamper, registered FIRST so LRU placement
//                picks them on attempt 1 (default 0)
//
// Tamperers register before clean workers so a job's first attempt lands on
// the cheaters deterministically: it fails verification, they are quarantined,
// and a subsequent attempt on the clean remainder self-heals — or, if there
// is no clean remainder / maxAttempts is 1, the job exhausts attempts (502).

import { createCoordinator } from '../../../poc/src/coordinator/coordinator.js';
import { createWorker } from '../../../poc/src/worker/worker.js';

const totalWorkers = Number(process.env.PC_WORKERS ?? 5);
const tamperCount = Number(process.env.PC_TAMPER ?? 0);

const coordinator = await createCoordinator();
const workers = [];

// Register tamperers first (lowest registeredSeq => picked first by LRU).
for (let i = 0; i < tamperCount; i++) {
  workers.push(
    await createWorker({
      id: `tamper-${i + 1}`,
      coordinatorUrl: coordinator.url,
      tamper: true,
    }),
  );
}
for (let i = 0; i < totalWorkers - tamperCount; i++) {
  workers.push(
    await createWorker({
      id: `clean-${i + 1}`,
      coordinatorUrl: coordinator.url,
    }),
  );
}

// One JSON line the fixture parses. Everything else is diagnostics on stderr.
process.stdout.write(
  JSON.stringify({
    url: coordinator.url,
    workers: workers.length,
    tamper: tamperCount,
  }) + '\n',
);
console.error(
  `[launcher] coordinator ${coordinator.url}, ${workers.length} workers ` +
    `(${tamperCount} tampering)`,
);

async function shutdown() {
  for (const w of workers) await w.close();
  await coordinator.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
