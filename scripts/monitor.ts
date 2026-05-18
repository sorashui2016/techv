import { monitorDueSources } from "../src/lib/monitor";

async function main() {
  const results = await monitorDueSources();
  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
