// Seed the initial game list (skips if games already exist):
//   DATABASE_URL=... npm run db:seed
import { neon } from "@neondatabase/serverless";
import { SEED_GAMES } from "../lib/seed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = neon(url);
  const existing = await db`select count(*)::int as n from games`;
  if (Number(existing[0].n) > 0) {
    console.log("games table not empty — skipping seed");
    return;
  }
  for (const g of SEED_GAMES) {
    await db`insert into games (name, company, appstore_id, play_id, meta_search, markets)
      values (${g.name}, ${g.company}, ${g.appstore_id}, ${g.play_id}, ${g.meta_search}, ${g.markets})`;
  }
  console.log(`seeded ${SEED_GAMES.length} games`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
