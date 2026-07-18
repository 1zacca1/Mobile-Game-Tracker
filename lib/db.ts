import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

export function sql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _sql = neon(url);
  }
  return _sql;
}

export type Game = {
  id: number;
  name: string;
  company: string;
  appstore_id: string | null;
  play_id: string | null;
  meta_search: string | null;
  markets: string[];
  active: boolean;
};
