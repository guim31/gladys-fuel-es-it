// -----------------------------------------------------------------------------
// Which stations to keep from an official list: the ones within the radius of
// the house, the ones of the chosen municipality, and the ones already added
// in Gladys (wherever they are). Plus the small helpers to read the numbers,
// names and dates of the two sources.
// -----------------------------------------------------------------------------

const EARTH_RADIUS_KM = 6371;
const rad = (degrees) => (degrees * Math.PI) / 180;

/** Great-circle distance in km. */
export function distanceKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "1,629" or "1.629" → 1.629; empty or not a number → null. */
export function parseNumber(text) {
  const value = Number(
    String(text ?? '')
      .trim()
      .replace(',', '.'),
  );
  return String(text ?? '').trim() !== '' && Number.isFinite(value) ? value : null;
}

/** A plausible price per litre (or kg), else null: the sources hold a few 0 and typos. */
export function parsePrice(text) {
  const value = parseNumber(text);
  return value !== null && value > 0.2 && value < 10 ? value : null;
}

/** A position, or null for the missing ones (0, empty, out of range). */
export function parsePosition(latText, lonText) {
  const lat = parseNumber(latText);
  const lon = parseNumber(lonText);
  if (lat === null || lon === null || (lat === 0 && lon === 0)) {
    return null;
  }
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

/** A name compared without case, accents nor punctuation: "Alcalá de Henares" = "ALCALA DE HENARES". */
export function nameKey(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** "12/11/2026 22:20:20" (both sources, local time) → "2026-11-12T22:20", else null. */
export function parseLocalDate(text) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/.exec(
    String(text ?? '').trim(),
  );
  if (!match) {
    return null;
  }
  const [, day, month, year, hour, minute] = match;
  const pad = (value) => value.padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${minute}`;
}

/**
 * The selection of a read.
 * @param {object} options
 * @param {{ lat: number, lon: number } | null} options.home
 * @param {number} options.radiusKm
 * @param {string} options.town
 * @param {Set<string>} options.keep station keys always kept (added in Gladys)
 * @returns {(station: object) => object | null} the station with `distanceKm`,
 *   `nearby` and `inTown`, or null when not selected
 */
export function createSelector({ home, radiusKm, town, keep }) {
  const townKey = nameKey(town);
  return (station) => {
    const distance = home && station.position ? distanceKm(home, station.position) : null;
    const nearby = distance !== null && distance <= radiusKm;
    const inTown = townKey !== '' && station.townKeys.includes(townKey);
    if (!nearby && !inTown && !keep.has(station.key)) {
      return null;
    }
    return {
      ...station,
      distanceKm: distance === null ? null : Math.round(distance * 10) / 10,
      nearby,
      inTown,
    };
  };
}
