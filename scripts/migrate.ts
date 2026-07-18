// Run schema migrations from a terminal: DATABASE_URL=... npm run db:migrate
import { neon } from "@neondatabase/serverless";
import { SCHEMA_SQL } from "../lib/schema";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = neon(url);
  for (const stmt of SCHEMA_SQL) {
    await db(stmt);
  }
  console.log(`applied ${SCHEMA_SQL.length} statements`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
