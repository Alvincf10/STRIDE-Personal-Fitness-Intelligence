import { parseAllStoredFits } from "../src/modules/fit/service";

async function main() {
  const result = await parseAllStoredFits(50);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
