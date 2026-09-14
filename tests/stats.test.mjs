import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { getProcessingStats, trackSuccessfulRemoval } from '../edge/stats.mjs';

const migration = readFileSync(
  new URL('../migrations/0001_processing_stats.sql', import.meta.url),
  'utf8',
);
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const SINCE = '2026-09-14T00:00:00.000Z';

function request({ method = 'POST', signal } = {}) {
  return new Request('https://bgpoof.example/api/remove-background', {
    method,
    signal,
  });
}

function database(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(migration);
  t.after(() => sqlite.close());
  return {
    sqlite,
    binding: {
      prepare(sql) {
        const statement = sqlite.prepare(sql);
        return {
          async run() {
            const result = statement.run();
            return { success: true, meta: { changes: result.changes } };
          },
          async first() {
            return statement.get() ?? null;
          },
        };
      },
    },
    count() {
      return sqlite
        .prepare('SELECT images_processed FROM processing_stats WHERE id = 1')
        .get().images_processed;
    },
  };
}

function backgroundTasks() {
  const pending = [];
  return {
    waitUntil: (promise) => {
      pending.push(Promise.resolve(promise));
    },
    async settle() {
      await Promise.all(pending);
    },
  };
}

function response(body = PNG) {
  return new Response(body, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'no-store',
      'x-removal-test': 'preserved',
    },
  });
}

async function assertUnavailable(binding) {
  const result = await getProcessingStats(binding);
  assert.equal(result.status, 503);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await result.json(), {
    error: 'Statistics are temporarily unavailable.',
  });
}

void test('the real migration starts at zero and repeated stats reads do not change the count', async (t) => {
  const db = database(t);
  assert.equal(db.count(), 0);

  let initial;
  for (let read = 0; read < 2; read += 1) {
    const result = await getProcessingStats(db.binding);
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('cache-control'), 'public, max-age=60');
    assert.match(result.headers.get('content-type'), /^application\/json\b/);
    const stats = await result.json();
    assert.deepEqual(Object.keys(stats).sort(), ['imagesProcessed', 'since']);
    assert.equal(stats.imagesProcessed, 0);
    assert.equal(typeof stats.since, 'string');
    assert.match(stats.since, /^\d{4}-\d{2}-\d{2}T.+Z$/);
    assert.ok(Number.isFinite(Date.parse(stats.since)));
    if (initial) assert.deepEqual(stats, initial);
    initial = stats;
  }
  assert.equal(db.count(), 0);
});

void test('counts once after the entire image finishes while preserving bytes and headers', async (t) => {
  const db = database(t);
  const tasks = backgroundTasks();
  let source;
  const input = response(
    new ReadableStream({
      start(controller) {
        source = controller;
        controller.enqueue(PNG.slice(0, 4));
      },
    }),
  );
  const output = trackSuccessfulRemoval(
    input,
    request(),
    db.binding,
    tasks.waitUntil,
  );
  assert.equal(output.status, input.status);
  assert.deepEqual([...output.headers], [...input.headers]);

  const reader = output.body.getReader();
  assert.deepEqual((await reader.read()).value, PNG.slice(0, 4));
  assert.equal(
    db.count(),
    0,
    'the first image chunk must not increment the total',
  );
  source.enqueue(PNG.slice(4));
  assert.deepEqual((await reader.read()).value, PNG.slice(4));
  assert.equal(
    db.count(),
    0,
    'receiving every byte is insufficient until the stream closes',
  );
  source.close();
  assert.deepEqual(await reader.read(), { done: true, value: undefined });
  await tasks.settle();
  assert.equal(db.count(), 1);
  assert.deepEqual(await reader.read(), { done: true, value: undefined });
  assert.equal(db.count(), 1);
});

void test('reading a cloned response still counts a single processed image', async (t) => {
  const db = database(t);
  const tasks = backgroundTasks();
  const output = trackSuccessfulRemoval(
    response(),
    request(),
    db.binding,
    tasks.waitUntil,
  );
  const copy = output.clone();
  const bodies = await Promise.all([output.arrayBuffer(), copy.arrayBuffer()]);
  for (const body of bodies) assert.deepEqual(new Uint8Array(body), PNG);
  await tasks.settle();
  assert.equal(db.count(), 1);
});

void test('concurrent successful removals accumulate without losing increments', async (t) => {
  const db = database(t);
  const tasks = backgroundTasks();
  const count = 64;
  await Promise.all(
    Array.from({ length: count }, async () => {
      const output = trackSuccessfulRemoval(
        response(),
        request(),
        db.binding,
        tasks.waitUntil,
      );
      assert.deepEqual(new Uint8Array(await output.arrayBuffer()), PNG);
    }),
  );
  await tasks.settle();
  assert.equal(db.count(), count);
  const stats = await getProcessingStats(db.binding);
  assert.equal((await stats.json()).imagesProcessed, count);
});

void test('unsuccessful responses, missing bodies or bindings, and non-POST requests pass through', async (t) => {
  const db = database(t);
  const tasks = backgroundTasks();
  const cases = [
    [new Response('invalid upload', { status: 400 }), request(), db.binding],
    [new Response('rate limited', { status: 429 }), request(), db.binding],
    [
      new Response('provider unavailable', { status: 502 }),
      request(),
      db.binding,
    ],
    [new Response(PNG, { status: 202 }), request(), db.binding],
    [new Response(null), request(), db.binding],
    [response(), request(), undefined],
    [response(), request({ method: 'GET' }), db.binding],
    [response(), request({ method: 'HEAD' }), db.binding],
  ];
  for (const [input, incoming, binding] of cases) {
    const output = trackSuccessfulRemoval(
      input,
      incoming,
      binding,
      tasks.waitUntil,
    );
    assert.equal(output, input);
    await output.arrayBuffer();
  }
  await tasks.settle();
  assert.equal(db.count(), 0);
});

void test('empty successful streams do not count as processed images', async (t) => {
  const db = database(t);
  const tasks = backgroundTasks();
  for (const body of [
    new Uint8Array(),
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array());
        controller.close();
      },
    }),
  ]) {
    const output = trackSuccessfulRemoval(
      response(body),
      request(),
      db.binding,
      tasks.waitUntil,
    );
    assert.equal((await output.arrayBuffer()).byteLength, 0);
  }
  await tasks.settle();
  assert.equal(db.count(), 0);
});

void test('a provider stream that errors after partial delivery does not increment the count', async (t) => {
  const db = database(t);
  const tasks = backgroundTasks();
  let source;
  const input = response(
    new ReadableStream({
      start(controller) {
        source = controller;
        controller.enqueue(PNG.slice(0, 4));
      },
    }),
  );
  const output = trackSuccessfulRemoval(
    input,
    request(),
    db.binding,
    tasks.waitUntil,
  );
  const reader = output.body.getReader();
  assert.deepEqual((await reader.read()).value, PNG.slice(0, 4));
  source.error(new Error('Image stream interrupted'));
  await assert.rejects(reader.read(), /Image stream interrupted/);
  await tasks.settle();
  assert.equal(db.count(), 0);
});

void test('canceling a partially delivered response does not increment the count', async (t) => {
  const db = database(t);
  const tasks = backgroundTasks();
  const input = response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(PNG.slice(0, 4));
      },
    }),
  );
  const output = trackSuccessfulRemoval(
    input,
    request(),
    db.binding,
    tasks.waitUntil,
  );
  const reader = output.body.getReader();
  assert.deepEqual((await reader.read()).value, PNG.slice(0, 4));
  await reader.cancel();
  await tasks.settle();
  assert.equal(db.count(), 0);
});

void test('aborted requests are excluded even when their response body finishes', async (t) => {
  const db = database(t);
  const tasks = backgroundTasks();
  const alreadyAborted = new AbortController();
  alreadyAborted.abort();
  const first = trackSuccessfulRemoval(
    response(),
    request({ signal: alreadyAborted.signal }),
    db.binding,
    tasks.waitUntil,
  );
  await first.arrayBuffer().catch(() => {});

  const controller = new AbortController();
  let source;
  const input = response(
    new ReadableStream({
      start(streamController) {
        source = streamController;
        streamController.enqueue(PNG);
      },
    }),
  );
  const output = trackSuccessfulRemoval(
    input,
    request({ signal: controller.signal }),
    db.binding,
    tasks.waitUntil,
  );
  const reader = output.body.getReader();
  assert.deepEqual((await reader.read()).value, PNG);
  controller.abort();
  source.close();
  await reader.read().catch(() => {});
  await tasks.settle();
  assert.equal(db.count(), 0);
});

void test(
  'a slow database does not hold up image delivery',
  { timeout: 5000 },
  async (t) => {
    const db = database(t);
    const tasks = backgroundTasks();
    let release;
    const blocked = new Promise((resolve) => {
      release = resolve;
    });
    const slowBinding = {
      prepare(sql) {
        const statement = db.binding.prepare(sql);
        return {
          async run() {
            await blocked;
            return statement.run();
          },
        };
      },
    };
    const output = trackSuccessfulRemoval(
      response(),
      request(),
      slowBinding,
      tasks.waitUntil,
    );
    try {
      const bytes = await Promise.race([
        output.arrayBuffer(),
        delay(1000).then(() => {
          throw new Error('Image delivery waited for the database');
        }),
      ]);
      assert.deepEqual(new Uint8Array(bytes), PNG);
      assert.equal(db.count(), 0);
    } finally {
      release();
      await tasks.settle();
    }
    assert.equal(db.count(), 1);
  },
);

void test('database failures cannot break a successfully delivered image', async () => {
  const brokenBindings = [
    {
      prepare() {
        throw new Error('Database unavailable');
      },
    },
    {
      prepare() {
        return {
          run() {
            throw new Error('Database unavailable');
          },
        };
      },
    },
    {
      prepare() {
        return {
          async run() {
            throw new Error('Database unavailable');
          },
        };
      },
    },
  ];
  for (const binding of brokenBindings) {
    const tasks = backgroundTasks();
    const output = trackSuccessfulRemoval(
      response(),
      request(),
      binding,
      tasks.waitUntil,
    );
    assert.deepEqual(new Uint8Array(await output.arrayBuffer()), PNG);
    await tasks.settle();
  }
});

void test('stats outages and missing singleton rows return a noncacheable generic error', async (t) => {
  const db = database(t);
  db.sqlite.exec('DELETE FROM processing_stats WHERE id = 1');
  await assertUnavailable(db.binding);
  await assertUnavailable(undefined);
  await assertUnavailable({});
  await assertUnavailable({
    prepare() {
      throw new Error('Database unavailable');
    },
  });
  await assertUnavailable({
    prepare() {
      return {
        async first() {
          throw new Error('Database unavailable');
        },
      };
    },
  });
});

void test('malformed stored stats cannot leak an invented or invalid public count', async () => {
  const invalidRows = [
    { images_processed: -1, since: SINCE },
    { images_processed: 0.5, since: SINCE },
    { images_processed: '10', since: SINCE },
    { images_processed: Number.MAX_SAFE_INTEGER + 1, since: SINCE },
    { images_processed: NaN, since: SINCE },
    { images_processed: Infinity, since: SINCE },
    { images_processed: 10, since: null },
    { images_processed: 10, since: 'invalid date' },
    { since: SINCE },
    {},
  ];
  for (const row of invalidRows) {
    await assertUnavailable({
      prepare() {
        return {
          async first() {
            return row;
          },
        };
      },
    });
  }
});
