// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys (with a located house), fake
// Spanish and Italian sources behind one fake `fetch`, a temporary /data and a
// manual clock, with the integration wired on top through registerHandlers.
// No timer runs unless `timers: true`: the tests call `app.tick()`. No test
// touches the network.
//
// The fixtures are real answers of 12/11/2026, cut down: Spain, the stations
// within 2.5 km of the Puerta del Sol in Madrid, a dozen in Barcelona and one
// in Albacete (the full list and its three provinces); Italy, the stations
// within 2 km of the centre of Rome, ten in Milan, two whose name holds a "|"
// and one without position (registry and price list). The Spanish service
// escapes its slashes ("12\/11\/2026"): the fake does too.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';
import { ALL_URL, BASE_URL as ES_URL } from '../../src/spain.js';
import { PRICES_URL, REGISTRY_URL } from '../../src/italy.js';

// The integration logs its lifecycle; keep the test output readable.
process.env.LOG_LEVEL ??= 'silent';

export const fixtureText = (name) =>
  readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
export const fixture = (name) => JSON.parse(fixtureText(name));

export const START = Date.UTC(2026, 10, 12, 22, 0, 0);
export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

export const MADRID = { latitude: 40.4168, longitude: -3.7038 };
export const ROME = { latitude: 41.9028, longitude: 12.4964 };
export const house = (position) => ({
  id: 'house-1',
  name: 'Maison',
  selector: 'maison',
  ...position,
});

/** A manual clock. */
export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/** A body in small chunks, as the network gives it (and to cut through characters). */
function chunked(text, size = 1000) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size) {
        controller.enqueue(bytes.slice(i, i + size));
      }
      controller.close();
    },
  });
}

/**
 * The fake sources. `es` holds the full Spanish list (an object, edited by the
 * tests); the provinces are cut from it. `it` holds the two CSV texts and
 * their ETags. `fail` replaces any answer when set. Every call is recorded.
 */
export function createFakeSources() {
  const sources = {
    calls: [],
    es: fixture('es-all.json'),
    it: {
      registry: fixtureText('it-anagrafica.csv'),
      prices: fixtureText('it-prezzi.csv'),
      registryEtag: '"r1"',
      pricesEtag: '"p1"',
    },
    /** @type {null | ((url: string) => Response)} */
    fail: null,
    /** @type {typeof fetch} */
    fetch: async (url, init = {}) => {
      const request = { url: String(url), headers: init.headers ?? {} };
      sources.calls.push(request);
      if (sources.fail) {
        return sources.fail(request.url);
      }
      const spanish = (list) =>
        new Response(
          chunked(JSON.stringify({ ...sources.es, ListaEESSPrecio: list }).replaceAll('/', '\\/')),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      if (request.url === ALL_URL) {
        return spanish(sources.es.ListaEESSPrecio);
      }
      const province = /FiltroProvincia\/(\d+)$/.exec(request.url)?.[1];
      if (request.url.startsWith(ES_URL) && province) {
        return spanish(sources.es.ListaEESSPrecio.filter((s) => s.IDProvincia === province));
      }
      for (const [target, text, etag] of [
        [REGISTRY_URL, sources.it.registry, sources.it.registryEtag],
        [PRICES_URL, sources.it.prices, sources.it.pricesEtag],
      ]) {
        if (request.url === target) {
          if (request.headers['if-none-match'] === etag) {
            return new Response(null, { status: 304 });
          }
          return new Response(chunked(text, 777), { status: 200, headers: { etag } });
        }
      }
      throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
    },
    count: () => sources.calls.length,
    urls: () => sources.calls.map((c) => c.url),
    /** Change a Spanish price ("1,629" format) of a station. */
    setSpanishPrice(id, field, value) {
      const station = sources.es.ListaEESSPrecio.find((s) => s.IDEESS === id);
      station[field] = value;
    },
  };
  return sources;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.houses]
 * @param {Array} [options.devices] devices already created in Gladys
 */
export async function createWorld({
  clock = createClock(),
  sources = createFakeSources(),
  config = { language: 'fr', country: 'es', radius_km: 3 },
  houses = [house(MADRID)],
  devices = [],
  connect = true,
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-fuel-es-it-')),
  timers = false,
} = {}) {
  const gladys = createFakeGladys({ config, devices, houses });
  const app = registerHandlers(gladys, {
    fetch: sources.fetch,
    store: new Store(dataDir),
    now: clock.now,
    timers,
  });
  if (connect) {
    await gladys.connect();
  }
  return { gladys, fake: gladys.fake, sources, app, clock, dataDir };
}

/** Add discovered devices in Gladys, as the user would (all, or the first `count`). */
export async function createAll(world, count = Infinity) {
  for (const device of world.fake.discoveredDevices.slice(0, count)) {
    await world.fake.deviceCreated(device);
  }
}

/** The discovered devices of a configuration. */
export async function discoveredDevices(options) {
  const world = await createWorld(options);
  const devices = world.fake.discoveredDevices;
  await world.app.stop();
  return devices;
}
