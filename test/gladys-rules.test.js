// -----------------------------------------------------------------------------
// Conformity with the Gladys core, on every device discovered from the
// real fixtures: Spain and Italy, every fuel, in every feature-name language,
// a municipality without a house, a subset of the fuels.
//
// The table (test/fixtures/gladys-feature-table.json) is extracted from the
// core code: a category/type couple missing there shows as "undefined" or
// without icon in Gladys, a poll frequency outside its list is a 400 on
// discovery, a feature without min/max is a 422 on "Add to Gladys".
// Do not loosen this test to make it pass: fix the integration.
// (From guim31/gladys-wled.)
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FUEL_KEYS } from '../src/fuels.js';
import { ROME, discoveredDevices, house } from './helpers/world.js';

const table = JSON.parse(
  await readFile(new URL('./fixtures/gladys-feature-table.json', import.meta.url), 'utf8'),
);

const rome = { houses: [house(ROME)] };
const scenarios = [
  { label: 'the default configuration (Spain, Madrid, 5 km)', options: { config: {} }, count: 16 },
  {
    label: 'Spain, every fuel, French names',
    options: { config: { language: 'fr', fuels: FUEL_KEYS, radius_km: 3 } },
    count: 16,
  },
  ...['en', 'de', 'es', 'fr'].map((language) => ({
    label: `Italy, Rome, every fuel, ${language} names`,
    options: { ...rome, config: { language, country: 'it', fuels: FUEL_KEYS, radius_km: 2 } },
    count: 34,
  })),
  {
    label: 'Italy, Milan without a house, LPG and methane only',
    options: {
      houses: [],
      config: { language: 'en', country: 'it', town: 'Milano', fuels: ['gpl', 'metano'] },
    },
    count: 11,
  },
];

for (const scenario of scenarios) {
  test(`every discovered device follows the Gladys rules (${scenario.label})`, async () => {
    const devices = await discoveredDevices(scenario.options);
    assert.equal(devices.length, scenario.count);

    const allExternalIds = new Set();
    for (const device of devices) {
      const where = device.name;
      assert.ok(!allExternalIds.has(device.external_id), `${where}: duplicate device external_id`);
      allExternalIds.add(device.external_id);

      // should_poll: true if and only if poll_frequency is provided, in ms.
      if (device.poll_frequency === undefined) {
        assert.notEqual(device.should_poll, true, `${where}: should_poll without poll_frequency`);
      } else {
        assert.equal(device.should_poll, true, `${where}: poll_frequency without should_poll`);
        assert.ok(
          table.poll_frequencies_ms.includes(device.poll_frequency),
          `${where}: poll_frequency ${device.poll_frequency} is not one of ${table.poll_frequencies_ms}`,
        );
      }

      assert.ok(device.features.length > 0, `${where}: no feature`);
      const names = new Set();
      for (const feature of device.features) {
        const at = `${where} / ${feature.name}`;
        const pair = table.pairs[`${feature.category}/${feature.type}`];
        assert.ok(pair, `${at}: ${feature.category}/${feature.type} is not a couple Gladys knows`);
        assert.ok(
          pair.label_en && pair.label_fr && pair.icon,
          `${at}: couple without label or icon`,
        );

        assert.equal(typeof feature.min, 'number', `${at}: min must be a number`);
        assert.equal(typeof feature.max, 'number', `${at}: max must be a number`);
        assert.ok(
          Number.isFinite(feature.min) && Number.isFinite(feature.max),
          `${at}: finite min/max`,
        );
        assert.ok(feature.min <= feature.max, `${at}: min > max`);
        assert.equal(typeof feature.read_only, 'boolean', `${at}: read_only must be a boolean`);
        assert.equal(
          typeof feature.has_feedback,
          'boolean',
          `${at}: has_feedback must be a boolean`,
        );
        if (feature.unit !== undefined) {
          assert.ok(table.units.includes(feature.unit), `${at}: unknown unit ${feature.unit}`);
        }

        assert.ok(!allExternalIds.has(feature.external_id), `${at}: duplicate external_id`);
        allExternalIds.add(feature.external_id);
        assert.ok(!names.has(feature.name), `${at}: duplicate feature name on the device`);
        names.add(feature.name);
      }
    }
  });
}
