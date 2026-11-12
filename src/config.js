// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys from the `config_schema` of
// `gladys-assistant-integration.json`. This module provides the defaults and
// normalizes the received object, so the rest of the code never deals with
// `undefined` or with a value typed by hand with stray spaces. The home
// location is not here: it is the one of the Gladys house (getHouses()).
// -----------------------------------------------------------------------------

import { COUNTRIES, FUEL_KEYS, fuelsOf } from './fuels.js';

/** The languages of the Gladys interface, every text exists in all four. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

export const RADIUS_MIN_KM = 1;
export const RADIUS_MAX_KM = 30;

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  // The country of the stations: one source per installation.
  country: 'es',
  // Fuels followed: the ones of the chosen country are used.
  fuels: ['gasolina_95', 'gasoleo_a', 'benzina_self', 'gasolio_self'],
  // Radius around the house of Gladys, for the station list and the cheapest.
  radius_km: 5,
  // A municipality whose stations are listed too (optional).
  town: '',
  // Language of the device and feature names (frozen when a device is added)
  // and of the texts the container produces (dates, trigger, action).
  language: 'fr',
};

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const country = String(raw.country ?? DEFAULT_CONFIG.country);
  const language = String(raw.language ?? DEFAULT_CONFIG.language);
  const radiusText = String(raw.radius_km ?? '').trim();
  const radius = radiusText === '' ? NaN : Math.round(Number(radiusText.replace(',', '.')));
  const followed = normalizeList(raw.fuels, (id) => FUEL_KEYS.includes(id));
  const fuels = raw.fuels === undefined || raw.fuels === null ? DEFAULT_CONFIG.fuels : followed;
  const normalized = {
    country: COUNTRIES.includes(country) ? country : DEFAULT_CONFIG.country,
    radiusKm: Number.isFinite(radius)
      ? Math.min(RADIUS_MAX_KM, Math.max(RADIUS_MIN_KM, radius))
      : DEFAULT_CONFIG.radius_km,
    town: String(raw.town ?? '').trim(),
    language: LANGUAGES.includes(language) ? language : DEFAULT_CONFIG.language,
  };
  // No fuel of the country at all would leave devices without a price: all
  // the fuels of the country then.
  const own = fuelsOf(normalized.country, fuels);
  normalized.fuels = own.length > 0 ? own : fuelsOf(normalized.country);
  return normalized;
}

/**
 * A multi_select value: an array (a comma-separated string is accepted too),
 * unknown values dropped, without duplicates.
 * @param {unknown} raw
 * @param {(id: string) => boolean} known
 * @returns {string[]}
 */
function normalizeList(raw, known) {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  return [...new Set(list.map((id) => String(id).trim()).filter(known))];
}
