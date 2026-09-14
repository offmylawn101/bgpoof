'use client';

import { useEffect, useState } from 'react';

export function ProcessingStats() {
  const [stats, setStats] = useState<{
    imagesProcessed: number;
    since: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    // This is independent of hydration and removal: a slow counter never blocks either.
    void fetch('/api/stats', { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as {
          imagesProcessed?: unknown;
          since?: unknown;
        } | null;
        if (!response.ok) return;
        if (
          typeof data?.imagesProcessed === 'number' &&
          Number.isSafeInteger(data.imagesProcessed) &&
          data.imagesProcessed >= 0 &&
          typeof data.since === 'string' &&
          Number.isFinite(Date.parse(data.since))
        )
          setStats({
            imagesProcessed: data.imagesProcessed,
            since: data.since,
          });
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  return (
    <p className="processing-stats">
      {stats && (
        <>
          <strong>{stats.imagesProcessed.toLocaleString('en-US')}</strong>{' '}
          {stats.imagesProcessed === 1 ? 'image processed' : 'images processed'}
          <span className="stats-since">
            Since{' '}
            {new Intl.DateTimeFormat('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              timeZone: 'UTC',
            }).format(new Date(stats.since))}
          </span>
        </>
      )}
    </p>
  );
}
