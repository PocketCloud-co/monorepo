// Standalone coordinator entry point:
//   PORT=4600 node src/coordinator/main.js
import { createCoordinator } from './coordinator.js';

const { url } = await createCoordinator({
  port: Number(process.env.PORT ?? 4600),
});
console.log(`[coordinator] listening at ${url}`);
