/**
 * API server entry point.
 *
 * Run: tsx src/index.ts
 *
 * Workers run separately: tsx src/workers.ts
 */

import { buildApp } from './app.js';

async function main() {
  const { app, env } = await buildApp();

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`${signal} received — shutting down`);
      await app.close();
      process.exit(0);
    });
  }

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`ClearMoney API running on ${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
