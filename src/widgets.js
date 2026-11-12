// -----------------------------------------------------------------------------
// The "Fuel prices" dashboard widget: the prices of a station added in Gladys,
// or of the cheapest device (the default), one tile per fuel followed; as
// details (a setting hides them), the station and distance of each cheapest
// price, or the opening hours of a station; a caption with the place and the
// last update.
//
// Budget (core): 8 components, 2 texts — at most 6 tiles, 1 status and 1
// caption here.
// -----------------------------------------------------------------------------

import { unitOf } from './fuels.js';
import { MESSAGES, TEXT, formatKm, formatLocal, fuelName, pick, stationLabel } from './i18n.js';

export const WIDGET_KEY = 'fuel_prices';
export const MAX_TILES = 6;

/** The content is cached by the core: Spain changes every 30 minutes. */
export const WIDGET_TTL_SECONDS = 900;

const short = (value, max = 40) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

/** The widget settings, normalized. */
export function normalizeSettings(settings = {}) {
  return {
    device: typeof settings.device === 'string' && settings.device ? settings.device : null,
    showDetails: settings.show_details !== false,
  };
}

/**
 * Build the widget content.
 * @param {object} options
 * @param {{ kind: 'cheapest', cheapest: object, located: boolean, radiusKm: number,
 *   town: string, updated: string | null } | { kind: 'station', station: object | null,
 *   title: string } | { kind: 'otherCountry' }} options.target
 * @param {string[]} options.fuels the fuels followed
 * @param {boolean} options.showDetails
 * @param {'ok' | 'waiting' | 'failing' | 'noPlace'} options.status
 * @param {string} options.language
 */
export function buildWidgetContent({ target, fuels, showDetails, status, language }) {
  const components = [];
  const message = (text) => {
    components.push({ type: 'text', variant: 'body', text: pick(text, language) });
    return { ttl_seconds: WIDGET_TTL_SECONDS, components };
  };
  if (target.kind === 'otherCountry') {
    return message(TEXT.otherCountry);
  }
  if (status !== 'ok') {
    return message(
      { waiting: TEXT.waiting, failing: TEXT.unreachable, noPlace: TEXT.noPlace }[status],
    );
  }
  if (target.kind === 'station' && !target.station) {
    return message(TEXT.delisted);
  }
  const priceOf =
    target.kind === 'station'
      ? (fuel) => target.station.prices[fuel]
      : (fuel) => target.cheapest[fuel]?.price;
  const shown = fuels.filter((fuel) => priceOf(fuel) !== undefined).slice(0, MAX_TILES);
  if (shown.length === 0) {
    return message(target.kind === 'station' ? TEXT.noPrice : TEXT.noStation);
  }
  for (const fuel of shown) {
    components.push({
      type: 'value',
      label: fuelName(fuel, language),
      value: Number(priceOf(fuel).toFixed(3)),
      unit: unitOf(fuel),
      icon: 'droplet',
    });
  }
  if (showDetails) {
    const items =
      target.kind === 'station'
        ? target.station.hours
          ? [{ label: pick(TEXT.hours, language), value: short(target.station.hours) }]
          : []
        : shown.map((fuel) => {
            const { station } = target.cheapest[fuel];
            const where =
              station.distanceKm === null
                ? stationLabel(station)
                : `${stationLabel(station)} · ${formatKm(station.distanceKm, language)}`;
            return { label: fuelName(fuel, language), value: short(where) };
          });
    if (items.length > 0) {
      components.push({ type: 'status', items });
    }
  }
  const caption =
    target.kind === 'station'
      ? [target.title, target.station.updated && formatLocal(target.station.updated, language)]
          .filter(Boolean)
          .join(' · ')
      : pick(
          target.located
            ? MESSAGES.within(target.radiusKm, target.updated)
            : MESSAGES.inTown(target.town, target.updated),
          language,
        );
  components.push({ type: 'text', variant: 'caption', text: short(caption, 200) });
  return { ttl_seconds: WIDGET_TTL_SECONDS, components };
}
