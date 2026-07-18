export const COUNTRY_NAMES: Record<string, string> = {
  us: "United States",
  kr: "South Korea",
  tw: "Taiwan",
  th: "Thailand",
  ph: "Philippines",
  id: "Indonesia",
  jp: "Japan",
  ww: "Worldwide",
};

export const DEFAULT_MARKETS = ["us", "kr", "tw", "th", "ph", "id", "jp"];

export function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code.toUpperCase();
}
