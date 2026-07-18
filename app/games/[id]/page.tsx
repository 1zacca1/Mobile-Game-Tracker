import { notFound } from "next/navigation";
import { getSeriesBundle } from "@/lib/bundle";
import { GameDetail } from "@/components/GameDetail";

export const dynamic = "force-dynamic";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gameId = Number(id);
  if (!gameId) notFound();
  const bundle = await getSeriesBundle(gameId, 180);
  if (!bundle) notFound();
  return <GameDetail bundle={bundle} />;
}
