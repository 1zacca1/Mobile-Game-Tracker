// Polite retry with exponential backoff + jitter. Collectors must throw on
// failure rather than return default values — the orchestrator logs the miss
// and moves on. A missing day is fine; a fabricated number is not.
export async function withRetry<T>(fn: () => Promise<T>, tries = 3, baseMs = 1500): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < tries - 1) {
        const wait = baseMs * 2 ** i + Math.random() * 500;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

// Run tasks with bounded concurrency; collects per-task errors instead of failing the batch.
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<{ results: R[]; errors: { item: T; error: string }[] }> {
  const results: R[] = [];
  const errors: { item: T; error: string }[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      try {
        results.push(await fn(item));
      } catch (err) {
        errors.push({ item, error: err instanceof Error ? err.message : String(err) });
      }
    }
  });
  await Promise.all(workers);
  return { results, errors };
}
