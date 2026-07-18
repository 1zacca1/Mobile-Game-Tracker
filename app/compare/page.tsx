import { getGames } from "@/lib/queries";
import { CompareView } from "@/components/CompareView";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  let games: Awaited<ReturnType<typeof getGames>> = [];
  try {
    games = await getGames();
  } catch {
    // DB not initialized yet — CompareView renders empty state
  }
  return <CompareView games={games} />;
}
