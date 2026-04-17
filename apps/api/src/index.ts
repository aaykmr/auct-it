import "dotenv/config";
import { env } from "./env.js";
import { buildApp } from "./app.js";
import { startBidWorker } from "./bid-worker.js";

async function main() {
  const app = await buildApp();
  await startBidWorker();
  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
