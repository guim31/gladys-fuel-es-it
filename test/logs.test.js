// -----------------------------------------------------------------------------
// Quiet logs: a normal cycle writes nothing at the info level, and a failure
// that lasts writes one line when it starts and one when it ends.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINUTE, createAll, createWorld } from './helpers/world.js';

/** Capture what the loggers write, at a given LOG_LEVEL. */
function captureLogs(t, level) {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = [];
  for (const stream of ['log', 'error']) {
    t.mock.method(console, stream, (...args) => lines.push(args.map(String).join(' ')));
  }
  return lines;
}

test('a normal cycle writes nothing at the info level', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world, 3);
  const lines = captureLogs(t, 'info');
  for (let i = 0; i < 8; i += 1) {
    world.clock.advance(30 * MINUTE);
    await world.app.tick();
    await world.fake.widgetGet('fuel_prices', { settings: {}, language: 'fr', units: 'metric' });
  }
  assert.ok(world.sources.count() >= 8);
  assert.deepEqual(lines, []);
});

test('a lasting failure: one line when it starts, one when it ends', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world, 3);
  const lines = captureLogs(t, 'info');
  world.sources.fail = () => new Response('down', { status: 503 });
  for (let i = 0; i < 5; i += 1) {
    world.clock.advance(30 * MINUTE);
    await world.app.tick();
  }
  assert.equal(world.sources.count(), 6);
  assert.equal(lines.length, 1);
  assert.match(
    lines[0],
    /\[WARN\].*official price list cannot be read: Ministry service answered HTTP 503/,
  );
  world.sources.fail = null;
  world.clock.advance(30 * MINUTE);
  await world.app.tick();
  assert.equal(lines.length, 2);
  assert.match(lines[1], /\[INFO\].*official price list answers again/);
});
