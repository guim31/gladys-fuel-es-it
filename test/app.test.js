// -----------------------------------------------------------------------------
// The integration end to end, against the SDK's fake Gladys and the fake
// sources (real answers, test/helpers/world.js).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { FULL_READ_MS, PRICE_DROP } from '../src/app.js';
import { cheapestIds, stationIds } from '../src/devices.js';
import { ALL_URL, provinceUrl } from '../src/spain.js';
import { PRICES_URL, REGISTRY_URL } from '../src/italy.js';
import { MAX_TILES, WIDGET_KEY } from '../src/widgets.js';
import {
  HOUR,
  MINUTE,
  ROME,
  createAll,
  createClock,
  createFakeSources,
  createWorld,
  house,
} from './helpers/world.js';

const ES = { language: 'fr', country: 'es', radius_km: 3 };
const IT = { language: 'fr', country: 'it', radius_km: 2 };

const widget = async (world, settings = {}, language = 'fr') => {
  const ack = await world.fake.widgetGet(WIDGET_KEY, { settings, language });
  assert.equal(ack.success, true, JSON.stringify(ack));
  return ack.data.content;
};

const textsOf = (content) => content.components.map((c) => c.text ?? c.label).join(' | ');

test('Spain: the cheapest device, then the nearest stations first, read from the full list', async (t) => {
  const world = await createWorld({ config: ES });
  t.after(() => world.app.stop());
  assert.deepEqual(world.sources.urls(), [ALL_URL]);
  const devices = world.fake.discoveredDevices;
  assert.equal(devices[0].external_id, cheapestIds(world.gladys, 'es').device);
  assert.equal(devices[0].name, 'Carburant le moins cher – Espagne');
  const stations = devices.slice(1);
  // The 15 stations within 2.5 km of the Puerta del Sol (+ 2 between 2.5 and 3 km? none in the cut).
  assert.equal(stations.length, 15);
  const distances = stations.map(
    (d) => world.app.snapshot.stations.get(d.external_id.split(':').pop()).distanceKm,
  );
  assert.deepEqual(
    distances,
    [...distances].sort((a, b) => a - b),
  );
  // Neither Barcelona nor Albacete.
  assert.ok(stations.every((d) => /^ext:.*:station:es-\d+$/.test(d.external_id)));
  assert.ok(!world.app.snapshot.stations.has('es-4375'));
  assert.equal(world.fake.connectionStatus.connected, true);
});

test('Spain: after the full list, only the provinces every 30 minutes, the full list once a day', async (t) => {
  const world = await createWorld({ config: ES });
  t.after(() => world.app.stop());
  world.clock.advance(29 * MINUTE);
  await world.app.tick();
  assert.equal(world.sources.count(), 1);
  world.clock.advance(MINUTE);
  await world.app.tick();
  assert.deepEqual(world.sources.urls().slice(1), [provinceUrl('28')]);
  world.clock.advance(FULL_READ_MS);
  await world.app.tick();
  assert.equal(world.sources.urls().at(-1), ALL_URL);
});

test('Spain: states of a station and of the cheapest device; a members-only station is never the cheapest', async (t) => {
  const sources = createFakeSources();
  const world = await createWorld({ config: ES, sources });
  t.after(() => world.app.stop());
  await createAll(world, 3);
  const [cheap, first] = world.fake.discoveredDevices;
  const key = first.external_id.split(':').pop();
  const station = world.app.snapshot.stations.get(key);
  const ids = stationIds(world.gladys, key);
  for (const fuel of Object.keys(station.prices)) {
    if (['gasolina_95', 'gasoleo_a'].includes(fuel)) {
      assert.equal(world.fake.lastState(ids.feature(`${fuel}_price`)), station.prices[fuel]);
    }
  }
  assert.equal(world.fake.lastState(ids.feature('updated')), '12/11/2026 22:20');
  assert.equal(world.fake.lastState(ids.feature('hours')), station.hours);
  // The cheapest diesel within 3 km.
  const all = [...world.app.snapshot.stations.values()].filter((s) => s.nearby);
  const lowest = Math.min(...all.filter((s) => s.prices.gasoleo_a).map((s) => s.prices.gasoleo_a));
  const best = cheapestIds(world.gladys, 'es');
  assert.equal(cheap.external_id, best.device);
  assert.equal(world.fake.lastState(best.feature('gasoleo_a_price')), lowest);
  assert.equal(typeof world.fake.lastState(best.feature('gasoleo_a_distance')), 'number');
  assert.match(world.fake.lastState(best.feature('gasoleo_a_station')), /, Madrid$/);

  // The same station, restricted to its members, at 0.5 €: still the other one.
  const winner = all.find((s) => s.prices.gasoleo_a === lowest);
  sources.setSpanishPrice(winner.id, 'Precio Gasoleo A', '0,999');
  sources.es.ListaEESSPrecio.find((s) => s.IDEESS === winner.id)['Tipo Venta'] = 'R';
  world.clock.advance(30 * MINUTE);
  await world.app.tick();
  const others = all.filter((s) => s.id !== winner.id && s.prices.gasoleo_a);
  assert.equal(
    world.fake.lastState(best.feature('gasoleo_a_price')),
    Math.min(...others.map((s) => s.prices.gasoleo_a)),
  );
});

test('the price drop trigger: first prices remembered, a drop fired once, not again after a restart', async (t) => {
  const sources = createFakeSources();
  const clock = createClock();
  const world = await createWorld({ config: ES, sources, clock });
  await createAll(world, 2);
  const key = world.fake.discoveredDevices[1].external_id.split(':').pop();
  const station = world.app.snapshot.stations.get(key);
  assert.deepEqual(world.fake.sceneEvents, []);
  assert.ok(world.app.prices[world.fake.discoveredDevices[1].external_id]);

  const previous = station.prices.gasolina_95;
  sources.setSpanishPrice(station.id, 'Precio Gasolina 95 E5', '0,999');
  clock.advance(30 * MINUTE);
  await world.app.tick();
  const events = world.fake.sceneEvents.filter((e) => e.key === PRICE_DROP);
  const own = events.find((e) => e.data.device === world.fake.discoveredDevices[1].external_id);
  assert.deepEqual(own.data, {
    device: world.fake.discoveredDevices[1].external_id,
    fuel: 'gasolina_95',
    fuel_name: 'Sans plomb 95',
    station: `${station.brand}, Madrid`,
    price: 0.999,
    previous_price: previous,
    drop: Math.round((previous - 0.999) * 1000) / 1000,
  });
  // 0.999 is also the new cheapest: the cheapest device fires too.
  assert.ok(events.some((e) => e.data.device === world.fake.discoveredDevices[0].external_id));
  const count = world.fake.sceneEvents.length;
  await world.app.stop();

  // Restart on the same /data: the same prices are not a drop.
  const again = await createWorld({
    config: ES,
    sources,
    clock,
    dataDir: world.dataDir,
    devices: world.fake.discoveredDevices.slice(0, 2),
  });
  t.after(() => again.app.stop());
  clock.advance(30 * MINUTE);
  await again.app.tick();
  assert.equal(again.fake.sceneEvents.length, 0);
  assert.equal(count, events.length);
});

test('a station gone from the list: no state, the widget says so', async (t) => {
  const sources = createFakeSources();
  const world = await createWorld({ config: ES, sources });
  t.after(() => world.app.stop());
  await createAll(world, 2);
  const device = world.fake.discoveredDevices[1];
  const id = device.external_id.split(':').pop().slice(3);
  sources.es.ListaEESSPrecio = sources.es.ListaEESSPrecio.filter((s) => s.IDEESS !== id);
  const before = world.fake.states.length;
  world.clock.advance(FULL_READ_MS);
  await world.app.tick();
  assert.ok(
    world.fake.states
      .slice(before)
      .every((s) => !s.device_feature_external_id.startsWith(device.external_id)),
  );
  const content = await widget(world, { device: device.external_id });
  assert.match(textsOf(content), /n’est plus dans la liste officielle/);
});

test('Italy: Rome, self-service and served apart, the files asked again with their ETag', async (t) => {
  const world = await createWorld({ config: IT, houses: [house(ROME)] });
  t.after(() => world.app.stop());
  assert.deepEqual(world.sources.urls(), [REGISTRY_URL, PRICES_URL]);
  const stations = [...world.app.snapshot.stations.values()];
  assert.equal(stations.length, 33);
  assert.equal(world.app.snapshot.updated, '2026-11-11');
  assert.ok(stations.some((s) => s.prices.benzina_self && s.prices.benzina_served));
  assert.ok(
    stations.every(
      (s) =>
        !s.prices.benzina_served ||
        !s.prices.benzina_self ||
        s.prices.benzina_served >= s.prices.benzina_self - 0.5,
    ),
  );
  await createAll(world, 1);
  const best = cheapestIds(world.gladys, 'it');
  const lowest = Math.min(
    ...stations.filter((s) => s.prices.gasolio_self).map((s) => s.prices.gasolio_self),
  );
  assert.equal(world.fake.lastState(best.feature('gasolio_self_price')), lowest);

  world.clock.advance(2 * HOUR);
  await world.app.tick();
  const calls = world.sources.calls.slice(2);
  assert.deepEqual(
    calls.map((c) => c.headers['if-none-match']),
    ['"r1"', '"p1"'],
  );
  // New prices of the day: read again (registry unchanged).
  world.sources.it.pricesEtag = '"p2"';
  world.clock.advance(2 * HOUR);
  await world.app.tick();
  assert.equal(world.sources.count(), 6);
});

test('Italy: a municipality without a located house (Milan): the cheapest without distance', async (t) => {
  const world = await createWorld({ config: { ...IT, town: 'milano' }, houses: [] });
  t.after(() => world.app.stop());
  await createAll(world, 1);
  const best = cheapestIds(world.gladys, 'it');
  assert.equal(typeof world.fake.lastState(best.feature('benzina_self_price')), 'number');
  assert.match(world.fake.lastState(best.feature('benzina_self_station')), /, MILANO$/);
  assert.equal(world.fake.lastState(best.feature('benzina_self_distance')), undefined);
  const content = await widget(world);
  assert.match(textsOf(content), /milano · 11\/11\/2026/);
});

test('a municipality without any station: listed nothing, said by the action', async (t) => {
  const world = await createWorld({ config: { ...ES, town: 'Villanueva de Gormaz' }, houses: [] });
  t.after(() => world.app.stop());
  assert.equal(world.fake.discoveredDevices.length, 1);
  const ack = await world.fake.action('test_source');
  assert.equal(ack.success, true);
  assert.match(
    ack.data.message ?? ack.data,
    /0 station\(s\) trouvée\(s\) à Villanueva de Gormaz\./,
  );
  const content = await widget(world);
  assert.match(textsOf(content), /Aucune station trouvée/);
});

test('no located house and no municipality: nothing read, the status says what to do', async (t) => {
  const world = await createWorld({ config: ES, houses: [] });
  t.after(() => world.app.stop());
  assert.equal(world.sources.count(), 0);
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.deepEqual(Object.keys(world.fake.connectionStatus.message).sort(), [
    'de',
    'en',
    'es',
    'fr',
  ]);
  const ack = await world.fake.action('test_source');
  assert.equal(ack.success, false);
});

test('a failing source: status down in four languages, retried after 30 minutes, then back', async (t) => {
  const sources = createFakeSources();
  sources.fail = () => new Response('busy', { status: 503 });
  const world = await createWorld({ config: ES, sources });
  t.after(() => world.app.stop());
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.es, /lista oficial/);
  world.clock.advance(10 * MINUTE);
  await world.app.tick();
  assert.equal(sources.count(), 1);
  sources.fail = null;
  world.clock.advance(20 * MINUTE);
  await world.app.tick();
  assert.equal(world.fake.connectionStatus.connected, true);
  assert.ok(world.fake.discoveredDevices.length > 1);
});

test('the action reads now and gives the cheapest price', async (t) => {
  const world = await createWorld({ config: { ...ES, language: 'en' } });
  t.after(() => world.app.stop());
  const ack = await world.fake.action('test_source');
  assert.equal(ack.success, true, JSON.stringify(ack));
  assert.match(
    ack.data.message ?? ack.data,
    /^Spain: 15 station\(s\) found within 3 km of the house\. Unleaded 95 cheapest: €1\.\d{3} \(.+\)\.$/,
  );
});

test('the widget: the cheapest by default, a station, the other country; always within the core budget', async (t) => {
  const world = await createWorld({
    config: { ...ES, fuels: ['gasolina_95', 'gasolina_98', 'gasoleo_a', 'gasoleo_premium', 'glp'] },
  });
  t.after(() => world.app.stop());
  await createAll(world, 2);
  const station = world.fake.discoveredDevices[1];
  const contents = [
    await widget(world),
    await widget(world, { show_details: false }, 'de'),
    await widget(world, { device: station.external_id }, 'es'),
    await widget(world, { device: stationIds(world.gladys, 'it-1').device }),
  ];
  for (const content of contents) {
    assert.doesNotThrow(() => validateWidgetContent(content));
    assert.ok(content.components.length <= 8);
    assert.ok(content.components.filter((c) => c.type === 'text').length <= 2);
    assert.ok(content.components.filter((c) => c.type === 'value').length <= MAX_TILES);
  }
  assert.ok(contents[0].components.some((c) => c.type === 'status'));
  assert.ok(!contents[1].components.some((c) => c.type === 'status'));
  assert.match(textsOf(contents[0]), /Dans un rayon de 3 km · 12\/11\/2026 22:20/);
  // The station widget shows the name given in Gladys.
  assert.match(textsOf(contents[2]), new RegExp(station.name.slice(0, 10)));
  assert.equal(contents[3].components[0].type, 'text');
});
