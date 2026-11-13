// -----------------------------------------------------------------------------
// The devices and their states.
//
// A station added from the discovery list ("station", key "es-<IDEESS>" or
// "it-<idImpianto>", the ids of the official lists):
//   currency/decimal + euro   <fuel>_price   per fuel followed it sells
//   text/text                 updated        last price change (local time)
//   text/text                 hours          opening hours (Spain only)
//
// "Cheapest fuel – <country>" ("cheapest", key "es" or "it"), per fuel
// followed: the lowest price within the radius of the house (in the
// municipality without a located house), the station and its distance:
//   currency/decimal + euro   <fuel>_price
//   text/text                 <fuel>_station
//   distance-sensor/decimal   <fuel>_distance   km
//
// "Price under a threshold" is a plain Gladys scene on a price feature; a drop
// is the integration's trigger (src/app.js). No core polling: the container
// reads the sources on its own timer. Ids must never change.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { unitOf } from './fuels.js';
import {
  COUNTRY_NAMES,
  NAMES,
  fuelName,
  formatLocal,
  pick,
  stationDeviceName,
  stationLabel,
} from './i18n.js';

export const STATION = 'station';
export const CHEAPEST = 'cheapest';

/** Display bounds of a price, €/l or €/kg (the highest seen are about 2.5 €). */
export const PRICE_MAX = 5;
export const DISTANCE_MAX = 50;

export const stationIds = (gladys, key) => gladys.externalIds(STATION, key);
export const cheapestIds = (gladys, country) => gladys.externalIds(CHEAPEST, country);

/**
 * The kind and key of a device external id: { kind: 'station', key: 'es-4375' }
 * or { kind: 'cheapest', key: 'es' }, else null.
 */
export function parseDeviceId(gladys, externalId) {
  const prefix = gladys.externalId('');
  const text = String(externalId ?? '');
  if (!text.startsWith(prefix)) {
    return null;
  }
  const match = /^(station|cheapest):((?:es|it)(?:-\d+)?)$/.exec(text.slice(prefix.length));
  return match ? { kind: match[1], key: match[2] } : null;
}

const base = { read_only: true, has_feedback: false, keep_history: true };

const feature = (ids, key, name, definition) => ({
  ...base,
  ...definition,
  name,
  external_id: ids.feature(key),
});

const money = {
  category: DEVICE_FEATURE_CATEGORIES.CURRENCY,
  type: DEVICE_FEATURE_TYPES.CURRENCY.DECIMAL,
  unit: DEVICE_FEATURE_UNITS.EURO,
  min: 0,
  max: PRICE_MAX,
};

// A text: no history, min/max NOT NULL in the core.
const text = {
  category: DEVICE_FEATURE_CATEGORIES.TEXT,
  type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
  keep_history: false,
  min: 0,
  max: 0,
};

const priceFeature = (ids, names, fuel, language) =>
  feature(ids, `${fuel}_price`, names.price(fuelName(fuel, language), unitOf(fuel)), money);

/** A station device: the fuels followed it sells. */
export function buildStationDevice(gladys, config, station) {
  const ids = stationIds(gladys, station.key);
  const names = NAMES[config.language] ?? NAMES.fr;
  return {
    name: stationDeviceName(station),
    external_id: ids.device,
    should_poll: false,
    features: [
      ...config.fuels
        .filter((fuel) => station.prices[fuel] !== undefined)
        .map((fuel) => priceFeature(ids, names, fuel, config.language)),
      feature(ids, 'updated', names.updated, text),
      ...(station.hours ? [feature(ids, 'hours', names.hours, text)] : []),
    ],
  };
}

/** The cheapest device of the country. */
export function buildCheapestDevice(gladys, config) {
  const ids = cheapestIds(gladys, config.country);
  const names = NAMES[config.language] ?? NAMES.fr;
  return {
    name: names.cheapest(pick(COUNTRY_NAMES[config.country], config.language)),
    external_id: ids.device,
    should_poll: false,
    features: config.fuels.flatMap((fuel) => {
      const label = fuelName(fuel, config.language);
      return [
        priceFeature(ids, names, fuel, config.language),
        feature(ids, `${fuel}_station`, names.station(label), text),
        feature(ids, `${fuel}_distance`, names.distance(label), {
          category: DEVICE_FEATURE_CATEGORIES.DISTANCE_SENSOR,
          // The SDK has no constant for this type (the core does: distance-sensor/decimal).
          type: 'decimal',
          unit: DEVICE_FEATURE_UNITS.KM,
          min: 0,
          max: DISTANCE_MAX,
        }),
      ];
    }),
  };
}

/**
 * The cheapest station per fuel: among the stations within the radius when the
 * house is located, else the ones of the municipality; never a station
 * restricted to its members. Equal prices: the nearest.
 * @returns {Record<string, { price: number, station: object }>}
 */
export function cheapestOf(stations, config, located) {
  const pool = stations.filter((s) => !s.restricted && (located ? s.nearby : s.inTown));
  const result = {};
  for (const fuel of config.fuels) {
    for (const station of pool) {
      const price = station.prices[fuel];
      if (price === undefined) {
        continue;
      }
      const best = result[fuel];
      if (
        !best ||
        price < best.price ||
        (price === best.price &&
          (station.distanceKm ?? Infinity) < (best.station.distanceKm ?? Infinity))
      ) {
        result[fuel] = { price, station };
      }
    }
  }
  return result;
}

/** The states of a station device. */
export function stationStates(gladys, config, station) {
  const ids = stationIds(gladys, station.key);
  const states = config.fuels
    .filter((fuel) => station.prices[fuel] !== undefined)
    .map((fuel) => ({
      device_feature_external_id: ids.feature(`${fuel}_price`),
      state: station.prices[fuel],
    }));
  if (station.updated) {
    states.push({
      device_feature_external_id: ids.feature('updated'),
      text: formatLocal(station.updated, config.language),
    });
  }
  if (station.hours) {
    states.push({ device_feature_external_id: ids.feature('hours'), text: station.hours });
  }
  return states;
}

/** The states of the cheapest device. */
export function cheapestStates(gladys, config, cheapest) {
  const ids = cheapestIds(gladys, config.country);
  const states = [];
  for (const fuel of config.fuels) {
    const best = cheapest[fuel];
    if (!best) {
      continue;
    }
    states.push(
      { device_feature_external_id: ids.feature(`${fuel}_price`), state: best.price },
      {
        device_feature_external_id: ids.feature(`${fuel}_station`),
        text: `${stationLabel(best.station)}, ${best.station.town}`.slice(0, 200),
      },
    );
    if (best.station.distanceKm !== null) {
      states.push({
        device_feature_external_id: ids.feature(`${fuel}_distance`),
        state: Math.min(best.station.distanceKm, DISTANCE_MAX),
      });
    }
  }
  return states;
}
