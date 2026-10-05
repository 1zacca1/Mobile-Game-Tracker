// Seed the initial game list (adds only games not already tracked):
//   DATABASE_URL=... npm run db:seed
import { neon } from "@neondatabase/serverless";
import { SEED_GAMES } from "../lib/seed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = neon(url);
  let seeded = 0;
  for (const g of SEED_GAMES) {
    const dup = await db`select 1 from games
      where (${g.appstore_id}::text is not null and appstore_id = ${g.appstore_id})
         or (${g.play_id}::text is not null and play_id = ${g.play_id})
         or name = ${g.name} limit 1`;
    if (dup.length) continue;
    await db`insert into games (name, company, appstore_id, play_id, meta_search, markets)
      values (${g.name}, ${g.company}, ${g.appstore_id}, ${g.play_id}, ${g.meta_search}, ${g.markets})`;
    seeded++;
  }
  console.log(`seeded ${seeded} new games`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
