// Initial tracked-game set. All store IDs were resolved from live App Store /
// Google Play listings — none are guessed. Games without an ID on one store
// (e.g. KR-only Android builds) are collected on the store(s) they have an ID
// for; the missing side can be filled in later from the Admin page.
export type SeedGame = {
  name: string;
  company: string;
  appstore_id: string | null;
  play_id: string | null;
  meta_search: string | null;
  markets: string[];
};

export const SEED_GAMES: SeedGame[] = [
  // ---- Century Games (read-through: Smadex / Entravision UA spend) ----
  { name: "Whiteout Survival", company: "Century Games", appstore_id: "6443575749", play_id: "com.gof.global", meta_search: "Whiteout Survival", markets: ["us", "kr", "tw", "th", "ph", "id", "jp"] },
  { name: "Kingshot", company: "Century Games", appstore_id: "6739554056", play_id: "com.run.tower.defense", meta_search: "Kingshot", markets: ["us", "kr", "tw", "th", "ph", "id", "jp"] },
  { name: "Frozen City", company: "Century Games", appstore_id: "1637040599", play_id: "com.fct.global", meta_search: "Frozen City", markets: ["us", "kr", "tw", "jp"] },
  // ---- Gravity (GRVY earnings read-through) ----
  { name: "Ragnarok Origin (NA)", company: "Gravity", appstore_id: "6459411007", play_id: "com.gravity.roo.lna", meta_search: "Ragnarok Origin", markets: ["us"] },
  { name: "Ragnarok Origin Global (SEA)", company: "Gravity", appstore_id: "1661507061", play_id: "com.gravity.roo.sea", meta_search: "Ragnarok Origin Global", markets: ["th", "ph", "id", "tw"] },
  { name: "Ragnarok Origin (KR)", company: "Gravity", appstore_id: null, play_id: "com.gravity.ragnarokorigin.aos", meta_search: null, markets: ["kr"] },
  { name: "Ragnarok Origin: Classic", company: "Gravity", appstore_id: "6768919292", play_id: "com.gravity.rooc.android", meta_search: "Ragnarok Origin Classic", markets: ["us", "th", "ph", "id", "tw"] },
  { name: "Ragnarok M: Eternal Love (NA/EU)", company: "Gravity", appstore_id: "1444739251", play_id: "com.gravity.romNAg", meta_search: "Ragnarok M Eternal Love", markets: ["us"] },
  { name: "Ragnarok M: Eternal Love (SEA)", company: "Gravity", appstore_id: "1404051022", play_id: "com.gravity.romg", meta_search: "Ragnarok M Eternal Love", markets: ["th", "ph", "id", "tw"] },
  { name: "Ragnarok M (KR)", company: "Gravity", appstore_id: null, play_id: "com.gravity.rom.aos", meta_search: null, markets: ["kr"] },
  { name: "Ragnarok X: Next Generation (SEA)", company: "Gravity", appstore_id: "1545808948", play_id: "com.play.rosea", meta_search: "Ragnarok X Next Generation", markets: ["th", "ph", "id", "tw"] },
  { name: "Ragnarok X: Next Generation (Global)", company: "Gravity", appstore_id: "6739808360", play_id: "global.thedream.and.rox", meta_search: "Ragnarok X Next Generation", markets: ["us", "kr", "jp"] },
  { name: "Ragnarok X (JP, GungHo)", company: "Gravity", appstore_id: null, play_id: "jp.gungho.rox", meta_search: null, markets: ["jp"] },
];
