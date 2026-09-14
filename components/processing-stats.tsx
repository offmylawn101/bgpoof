'use client';

import { useEffect, useState } from 'react';

export function ProcessingStats() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    // This is independent of hydration and removal: a slow counter never blocks either.
    void fetch('/api/stats', { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as {
          imagesProcessed?: unknown;
        } | null;
        if (!response.ok) return;
        if (
          typeof data?.imagesProcessed === 'number' &&
          Number.isSafeInteger(data.imagesProcessed) &&
          data.imagesProcessed >= 0
        )
          setCount(data.imagesProcessed);
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
      {count !== null && (
        <>
          <strong>{count.toLocaleString('en-US')}</strong>{' '}
          {count === 1 ? 'image processed' : 'images processed'}
        </>
      )}
    </p>
  );
}
