// -----------------------------------------------------------------------------
// Spain: the REST service of the Ministry for the Ecological Transition
// (Geoportal de Hidrocarburos), open, without key, refreshed every 30 minutes.
//
//   GET …/EstacionesTerrestres/                         every station (≈ 12 MB)
//   GET …/EstacionesTerrestres/FiltroProvincia/<id>      one province (≈ 1 MB)
//
// Answer: { Fecha: "12/11/2026 22:20:20", ListaEESSPrecio: [ { IDEESS, Rótulo,
// Dirección, Municipio, Localidad, IDProvincia, Latitud, "Longitud (WGS84)",
// Horario, "Tipo Venta", "Precio Gasoleo A": "1,799", … } ], ResultadoConsulta:
// "OK" }. Decimal commas, empty strings for the fuels not sold. "Tipo Venta" R
// is a station restricted to its members (cooperatives): never the cheapest.
// -----------------------------------------------------------------------------

import { FUELS, fuelsOf } from './fuels.js';
import { nameKey, parseLocalDate, parsePosition, parsePrice } from './geo.js';
import { arrayObjects } from './stream.js';

export const BASE_URL =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes';
export const ALL_URL = `${BASE_URL}/EstacionesTerrestres/`;
export const provinceUrl = (id) => `${BASE_URL}/EstacionesTerrestres/FiltroProvincia/${id}`;

const TIMEOUT_MS = 120 * 1000;

export class SourceError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = 'SourceError';
    this.status = status;
  }
}

/** A station of the list, normalized (the shape shared with src/italy.js). */
export function normalizeStation(raw, updated) {
  const id = String(raw.IDEESS ?? '').trim();
  const prices = {};
  for (const fuel of fuelsOf('es')) {
    const price = parsePrice(raw[FUELS[fuel].source]);
    if (price !== null) {
      prices[fuel] = price;
    }
  }
  const hours = String(raw.Horario ?? '').trim();
  return {
    key: `es-${id}`,
    id,
    country: 'es',
    brand: String(raw['Rótulo'] ?? '').trim(),
    address: String(raw['Dirección'] ?? '').trim(),
    town: String(raw.Municipio ?? raw.Localidad ?? '').trim(),
    townKeys: [nameKey(raw.Municipio), nameKey(raw.Localidad)].filter(Boolean),
    province: String(raw.IDProvincia ?? '').trim(),
    position: parsePosition(raw.Latitud, raw['Longitud (WGS84)']),
    hours: hours || null,
    restricted: String(raw['Tipo Venta'] ?? '').trim() === 'R',
    prices,
    updated,
  };
}

/**
 * Read one list (all stations, or a province) in a stream.
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {(station: object) => object | null} select
 * @returns {Promise<{ stations: object[], updated: string | null, count: number }>}
 */
export async function readList(fetchImpl, url, select) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new SourceError(`Ministry service unreachable (${err.cause?.code ?? err.message})`);
  }
  if (!response.ok || !response.body) {
    throw new SourceError(`Ministry service answered HTTP ${response.status}`, {
      status: response.status,
    });
  }
  let updated = null;
  const stations = [];
  let count = 0;
  try {
    const objects = arrayObjects(response.body, (head) => {
      // "12\/11\/2026 22:20:20": a JSON string, slashes escaped.
      const fecha = /"Fecha"\s*:\s*("(?:[^"\\]|\\.)*")/.exec(head)?.[1];
      updated = fecha ? parseLocalDate(JSON.parse(fecha)) : null;
    });
    for await (const raw of objects) {
      count += 1;
      const station = select(normalizeStation(raw, updated));
      if (station) {
        stations.push(station);
      }
    }
  } catch (err) {
    throw new SourceError(`Ministry list unreadable (${err.message})`);
  }
  if (updated === null) {
    throw new SourceError('Ministry list without its date: not the expected answer');
  }
  return { stations, updated, count };
}

/**
 * The stations to keep. A full read (every station) finds the provinces the
 * selection lies in; the next reads only ask for these provinces.
 * @param {typeof fetch} fetchImpl
 * @param {object} options
 * @param {(station: object) => object | null} options.select
 * @param {string[] | null} options.provinces null: read every station
 * @returns {Promise<{ stations: object[], updated: string, provinces: string[] }>}
 */
export async function readSpain(fetchImpl, { select, provinces }) {
  if (!provinces) {
    const { stations, updated, count } = await readList(fetchImpl, ALL_URL, select);
    // The Ministry sometimes answers an empty list when degraded: never
    // taken for a country without stations (nor its provinces for a day).
    if (count === 0) {
      throw new SourceError('Ministry answered an empty list of stations');
    }
    return {
      stations,
      updated,
      provinces: [...new Set(stations.map((s) => s.province).filter(Boolean))].sort(),
    };
  }
  const stations = [];
  let updated = null;
  for (const province of provinces) {
    const list = await readList(fetchImpl, provinceUrl(province), select);
    stations.push(...list.stations);
    updated = updated === null || list.updated > updated ? list.updated : updated;
  }
  return { stations, updated, provinces };
}
