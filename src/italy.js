// -----------------------------------------------------------------------------
// Italy: the open data of the Ministry of Enterprises and Made in Italy (MIMIT,
// "Osservaprezzi carburanti"), without key, two CSV files published every
// morning (prices in force the day before at 8:00):
//
//   anagrafica_impianti_attivi.csv  the active stations (≈ 24 000, 3.5 MB)
//     idImpianto|Gestore|Bandiera|Tipo Impianto|Nome Impianto|Indirizzo|Comune|Provincia|Latitudine|Longitudine
//   prezzo_alle_8.csv               their prices (≈ 90 000 lines, 4 MB)
//     idImpianto|descCarburante|prezzo|isSelf|dtComu
//
// Both start with an "Estrazione del YYYY-MM-DD" line, then the header. A few
// station names hold a "|" themselves: the fields are taken from both ends.
// Both files are read in a stream and filtered on the fly, and asked again
// with their ETag: a 304 costs nothing.
// -----------------------------------------------------------------------------

import { FUELS, fuelsOf } from './fuels.js';
import { nameKey, parseLocalDate, parsePosition, parsePrice } from './geo.js';
import { SourceError } from './spain.js';
import { lines } from './stream.js';

export const BASE_URL = 'https://www.mimit.gov.it/images/exportCSV';
export const REGISTRY_URL = `${BASE_URL}/anagrafica_impianti_attivi.csv`;
export const PRICES_URL = `${BASE_URL}/prezzo_alle_8.csv`;

const TIMEOUT_MS = 120 * 1000;
const ROAD_TYPES = new Set(['Stradale', 'Autostradale', 'Altro']);

/**
 * A conditional GET.
 * @returns {Promise<{ notModified: true } | { notModified: false, etag: string | null, body: ReadableStream }>}
 */
async function get(fetchImpl, url, etag) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: 'text/csv', ...(etag ? { 'if-none-match': etag } : {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new SourceError(`MIMIT open data unreachable (${err.cause?.code ?? err.message})`);
  }
  if (response.status === 304 && etag) {
    return { notModified: true };
  }
  if (!response.ok || !response.body) {
    throw new SourceError(`MIMIT open data answered HTTP ${response.status}`, {
      status: response.status,
    });
  }
  return { notModified: false, etag: response.headers.get('etag'), body: response.body };
}

/** A line of the registry, normalized (prices filled later), or null. */
export function parseRegistryLine(line) {
  const fields = line.split('|');
  if (fields.length < 10 || !/^\d+$/.test(fields[0].trim())) {
    return null;
  }
  const n = fields.length;
  // The station type sits right after the brand: it anchors the middle fields.
  let typeAt = fields.findIndex((field, i) => i >= 3 && ROAD_TYPES.has(field.trim()));
  if (typeAt < 0 || typeAt > n - 7) {
    typeAt = 3;
  }
  const id = fields[0].trim();
  const town = fields[n - 4].trim();
  return {
    key: `it-${id}`,
    id,
    country: 'it',
    brand: fields[typeAt - 1].trim(),
    name: fields
      .slice(typeAt + 1, n - 5)
      .join('|')
      .trim(),
    address: fields[n - 5].trim().replace(/\s+/g, ' '),
    town,
    townKeys: [nameKey(town)].filter(Boolean),
    province: fields[n - 3].trim(),
    position: parsePosition(fields[n - 2], fields[n - 1]),
    hours: null,
    restricted: false,
    prices: {},
    updated: null,
  };
}

/** A line of the price list: { id, fuels, price, updated } or null. */
export function parsePriceLine(line) {
  const [id, desc, priceText, isSelf, date] = line.split('|');
  const price = parsePrice(priceText);
  if (!/^\d+$/.test(String(id).trim()) || price === null) {
    return null;
  }
  const self = String(isSelf).trim() === '1';
  const fuels = fuelsOf('it').filter(
    (key) =>
      FUELS[key].source === String(desc).trim() &&
      (FUELS[key].self === undefined || FUELS[key].self === self),
  );
  return fuels.length > 0 ? { id: id.trim(), fuels, price, updated: parseLocalDate(date) } : null;
}

const extractionOf = (line) => /(\d{4}-\d{2}-\d{2})/.exec(line)?.[1] ?? null;

/**
 * Read both files and keep the selected stations with their prices.
 * @param {typeof fetch} fetchImpl
 * @param {object} options
 * @param {(station: object) => object | null} options.select
 * @param {object | null} options.cache the `cache` of the previous read with
 *   the same selection, or null to read everything again
 * @returns {Promise<{ stations: object[], updated: string | null, changed: boolean, cache: object }>}
 */
export async function readItaly(fetchImpl, { select, cache }) {
  const registry = await get(fetchImpl, REGISTRY_URL, cache?.registryEtag);
  let selected;
  let registryEtag = cache?.registryEtag ?? null;
  if (registry.notModified) {
    selected = cache.selected;
  } else {
    registryEtag = registry.etag;
    selected = new Map();
    try {
      for await (const line of lines(registry.body)) {
        const parsed = parseRegistryLine(line);
        const station = parsed && select(parsed);
        if (station) {
          selected.set(station.id, station);
        }
      }
    } catch (err) {
      throw new SourceError(`MIMIT registry unreadable (${err.message})`);
    }
  }
  const prices = await get(fetchImpl, PRICES_URL, registry.notModified ? cache?.pricesEtag : null);
  if (prices.notModified) {
    return { ...cache.result, changed: false, cache };
  }
  /** id → { fuel: { price, updated } } */
  const found = new Map();
  let extraction = null;
  try {
    for await (const line of lines(prices.body)) {
      extraction ??= extractionOf(line);
      const parsed = parsePriceLine(line);
      if (!parsed || !selected.has(parsed.id)) {
        continue;
      }
      const station = found.get(parsed.id) ?? {};
      for (const fuel of parsed.fuels) {
        // LPG and methane, self and served: the lowest.
        if (!station[fuel] || parsed.price < station[fuel].price) {
          station[fuel] = { price: parsed.price, updated: parsed.updated };
        }
      }
      found.set(parsed.id, station);
    }
  } catch (err) {
    throw new SourceError(`MIMIT price list unreadable (${err.message})`);
  }
  if (extraction === null) {
    throw new SourceError('MIMIT price list without its date: not the expected file');
  }
  const stations = [...selected.values()].map((station) => {
    const fuels = found.get(station.id) ?? {};
    const dates = Object.values(fuels)
      .map((entry) => entry.updated)
      .filter(Boolean)
      .sort();
    return {
      ...station,
      prices: Object.fromEntries(Object.entries(fuels).map(([fuel, e]) => [fuel, e.price])),
      updated: dates.at(-1) ?? null,
    };
  });
  const result = { stations, updated: extraction };
  return {
    ...result,
    changed: true,
    cache: { registryEtag, pricesEtag: prices.etag, selected, result },
  };
}
