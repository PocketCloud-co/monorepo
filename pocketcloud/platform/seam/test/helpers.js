// Test helpers: build priced receipt bodies (without prevHash/hash — the R2
// log seals them). Legs are computed here the way the ledger/pricing does:
// independent legs, license-mode zero worker leg (SEC-001 gap-11 shape).

const CUSTOMER_PER_UNIT = 1000;
const WORKER_PER_UNIT = 600;

export function receiptBody({
  jobId,
  attempt = 1,
  workerId,
  template = 'matvec',
  units = 24,
  verified = true,
  poolId = '',
  payoutsEnabled = true,
}) {
  const payable = verified === true;
  const customer = payable ? units * CUSTOMER_PER_UNIT : 0;
  const worker = payable && payoutsEnabled ? units * WORKER_PER_UNIT : 0;
  const platform = customer - worker;
  return {
    schemaVersion: 1,
    receiptId: `${jobId}:${attempt}:${workerId}`,
    jobId,
    attempt,
    workerId,
    template,
    units,
    verified: payable,
    payable,
    poolId,
    priceConfigVersion: 'pc-v1',
    customerMillicredits: customer,
    workerMillicredits: worker,
    platformMillicredits: platform,
  };
}
