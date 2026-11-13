// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACTION_KEY, PRICE_DROP, TRIGGER_KEYS } from '../src/app.js';
import { DEFAULT_CONFIG, LANGUAGES, RADIUS_MAX_KM, RADIUS_MIN_KM } from '../src/config.js';
import { FUELS, FUEL_KEYS } from '../src/fuels.js';
import { COUNTRY_NAMES } from '../src/i18n.js';
import { WIDGET_KEY } from '../src/widgets.js';
import { MINUTE, createAll, createFakeSources, createWorld } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const field = (key) => manifest.config_schema.find((f) => f.key === key);

test('identity: name, image, cover, cloud transport, categories, Spain and Italy, location', () => {
  assert.equal(manifest.name, 'Fuel prices Spain & Italy');
  assert.equal(manifest.type, 'device');
  assert.match(manifest.docker_image, /^ghcr\.io\/guim31\/gladys-fuel-es-it:/);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-fuel-es-it/main/cover.png',
  );
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.deepEqual(manifest.categories, ['transport', 'energy']);
  assert.deepEqual(manifest.countries, ['ES', 'IT']);
  // getHouses() needs it (403 otherwise).
  assert.equal(manifest.location, true);
  // `countries` needs Gladys 5.3.0 (and covers the 5.1.0 of the trigger and widget).
  assert.equal(manifest.gladys_version, '>=5.3.0');
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version, 'manifest version must match package.json');
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`));
});

test('a trigger, a widget, an action, no scene action', () => {
  assert.deepEqual(keysOf(manifest.scene_triggers), TRIGGER_KEYS);
  assert.deepEqual(keysOf(manifest.widgets), [WIDGET_KEY]);
  assert.deepEqual(keysOf(manifest.actions), [ACTION_KEY]);
  // An action applies no `default` and cannot fill a secret (Gladys#3154, #3155).
  assert.equal(manifest.actions[0].fields, undefined);
  assert.equal(manifest.scene_actions, undefined);
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  const valued = manifest.config_schema.filter((f) => f.type !== 'section');
  assert.deepEqual(keysOf(valued).sort(), Object.keys(DEFAULT_CONFIG).sort());
  for (const f of valued) {
    if (f.default !== undefined) {
      assert.deepEqual(DEFAULT_CONFIG[f.key], f.default, f.key);
    }
  }
  assert.deepEqual(
    field('language').options.map((o) => o.value),
    LANGUAGES,
  );
  assert.deepEqual(
    field('country').options.map((o) => [o.value, o.label]),
    Object.entries(COUNTRY_NAMES),
  );
  // Number fields are rendered without `step`: integers only.
  assert.equal(field('radius_km').min, RADIUS_MIN_KM);
  assert.equal(field('radius_km').max, RADIUS_MAX_KM);
  assert.ok(Number.isInteger(field('radius_km').default));
});

test('every fuel option is a fuel of the code, named like the code, with its country', () => {
  for (const options of [
    field('fuels').options,
    manifest.scene_triggers[0].fields.find((f) => f.key === 'fuel').options,
  ]) {
    assert.deepEqual(
      options.map((o) => o.value),
      FUEL_KEYS,
    );
    for (const option of options) {
      const fuel = FUELS[option.value];
      for (const lang of LANGUAGES) {
        assert.equal(
          option.label[lang],
          `${fuel.name[lang]} (${COUNTRY_NAMES[fuel.country][lang]})`,
        );
      }
    }
  }
});

test('the widget settings: a device of the integration, and the details hidden by a setting', () => {
  const settings = manifest.widgets[0].settings;
  assert.deepEqual(keysOf(settings), ['device', 'show_details']);
  assert.equal(settings[0].source, 'devices');
  assert.equal(settings[1].default, true);
});

test('the configuration names both sources and says not affiliated', () => {
  const intro = field('intro');
  assert.match(intro.description.en, /Not affiliated/);
  assert.match(intro.description.fr, /Sans lien avec/);
  assert.equal(intro.links.length, 2);
  for (const link of intro.links) {
    assert.match(link.url, /^https:\/\//);
  }
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});

test('the trigger sends exactly its declared fields and variables, with their types', async (t) => {
  const sources = createFakeSources();
  const world = await createWorld({ sources });
  t.after(() => world.app.stop());
  await createAll(world, 3);
  for (const station of sources.es.ListaEESSPrecio) {
    for (const key of ['Precio Gasolina 95 E5', 'Precio Gasoleo A']) {
      if (station[key]) {
        station[key] = '0,900';
      }
    }
  }
  world.clock.advance(30 * MINUTE);
  await world.app.tick();
  const events = world.fake.sceneEvents.filter((e) => e.key === PRICE_DROP);
  assert.ok(events.length >= 3);
  const [trigger] = manifest.scene_triggers;
  const declared = [...keysOf(trigger.fields), ...keysOf(trigger.variables)];
  for (const { data } of events) {
    assert.deepEqual(Object.keys(data).sort(), [...new Set(declared)].sort());
    for (const variable of trigger.variables) {
      assert.equal(typeof data[variable.key], variable.type, variable.key);
    }
    // The filters compare with the event value of the same key.
    assert.ok(trigger.fields[1].options.some((o) => o.value === data.fuel));
    assert.ok(world.gladys.devices.some((d) => d.external_id === data.device));
  }
});
