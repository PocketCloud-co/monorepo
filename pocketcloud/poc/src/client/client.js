// Minimal customer SDK: submit a job to the fabric and await the verified
// result. Mirrors PRD requirement F1/F4 (managed mode).

export async function submitJob(coordinatorUrl, job) {
  const res = await fetch(`${coordinatorUrl}/jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(job),
  });
  const body = await res.json();
  if (!res.ok || !body.ok) {
    const err = new Error(body.error ?? `job failed with status ${res.status}`);
    err.attempts = body.attempts;
    throw err;
  }
  return body;
}

export async function listWorkers(coordinatorUrl) {
  const res = await fetch(`${coordinatorUrl}/workers`);
  return (await res.json()).workers;
}
