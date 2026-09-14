async function incrementProcessed(database) {
  try {
    const result = await database
      .prepare(
        'UPDATE processing_stats SET images_processed = images_processed + 1 WHERE id = 1',
      )
      .run();
    if (!result.success || result.meta.changes !== 1)
      throw new Error('Counter not initialized');
  } catch {
    // Statistics must not break a completed removal or expose binding errors.
    console.warn('processing_stats_write_failed');
  }
}

export function trackSuccessfulRemoval(response, request, database, waitUntil) {
  if (
    !database ||
    request.method !== 'POST' ||
    response.status !== 200 ||
    !response.body
  )
    return response;

  let hasBytes = false;
  const body = response.body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        hasBytes ||= chunk.byteLength > 0;
        controller.enqueue(chunk);
      },
      flush() {
        // flush is never called on a failed/cancelled stream. No tee or image buffer.
        if (hasBytes && !request.signal.aborted) {
          try {
            waitUntil(incrementProcessed(database));
          } catch {
            console.warn('processing_stats_schedule_failed');
          }
        }
      },
    }),
  );
  return new Response(body, response);
}

export async function getProcessingStats(database) {
  try {
    const row = await database
      ?.prepare(
        'SELECT images_processed, since FROM processing_stats WHERE id = 1',
      )
      .first();
    if (
      !Number.isSafeInteger(row?.images_processed) ||
      row.images_processed < 0 ||
      typeof row.since !== 'string' ||
      !Number.isFinite(Date.parse(row.since))
    )
      throw new Error('Counter unavailable');
    return Response.json(
      { imagesProcessed: row.images_processed, since: row.since },
      {
        headers: {
          'Cache-Control': 'public, max-age=60',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  } catch {
    return Response.json(
      { error: 'Statistics are temporarily unavailable.' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  }
}
