// Standalone worker entry point:
//   WORKER_ID=w1 PORT=4601 COORDINATOR_URL=http://127.0.0.1:4600 node src/worker/main.js
// Set TAMPER=1 to simulate a malicious host.
import { createWorker } from './worker.js';

const worker = await createWorker({
  id: process.env.WORKER_ID ?? `worker-${process.pid}`,
  port: Number(process.env.PORT ?? 0),
  coordinatorUrl: process.env.COORDINATOR_URL ?? 'http://127.0.0.1:4600',
  tamper: process.env.TAMPER === '1',
});
console.log(
  `[worker ${worker.id}] listening at ${worker.url}` +
    (process.env.TAMPER === '1' ? ' (TAMPERING)' : ''),
);
