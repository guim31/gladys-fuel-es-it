// -----------------------------------------------------------------------------
// Every text the integration shows, in the four languages of the Gladys
// interface (en, fr, de, es). German says "du", Spanish says "usted", like the
// rest of guim31's integrations. Brands, station and place names stay as is.
//
//   - NAMES    : device and feature names, written once in the language of
//                the configuration (Gladys freezes them when a device is added);
//   - TEXT     : the fixed texts (widget, configuration screen, actions);
//   - MESSAGES : the texts built from a value, numbers in the local format.
//
// test/i18n.test.js checks that every entry carries exactly the four
// languages, with no empty text and no polite German.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';
import { FUELS } from './fuels.js';

export { LANGUAGES };

export const COUNTRY_NAMES = {
  es: { en: 'Spain', fr: 'Espagne', de: 'Spanien', es: 'España' },
  it: { en: 'Italy', fr: 'Italie', de: 'Italien', es: 'Italia' },
};

/** Device and feature names, by language then key. */
export const NAMES = {
  en: {
    cheapest: (country) => `Cheapest fuel – ${country}`,
    price: (fuel, unit) => `${fuel} (${unit})`,
    station: (fuel) => `${fuel}, station`,
    distance: (fuel) => `${fuel}, distance`,
    updated: 'Last price update',
    hours: 'Opening hours',
  },
  fr: {
    cheapest: (country) => `Carburant le moins cher – ${country}`,
    price: (fuel, unit) => `${fuel} (${unit})`,
    station: (fuel) => `${fuel}, station`,
    distance: (fuel) => `${fuel}, distance`,
    updated: 'Dernière mise à jour des prix',
    hours: 'Horaires',
  },
  de: {
    cheapest: (country) => `Günstigster Kraftstoff – ${country}`,
    price: (fuel, unit) => `${fuel} (${unit})`,
    station: (fuel) => `${fuel}, Tankstelle`,
    distance: (fuel) => `${fuel}, Entfernung`,
    updated: 'Letzte Preisänderung',
    hours: 'Öffnungszeiten',
  },
  es: {
    cheapest: (country) => `Carburante más barato – ${country}`,
    price: (fuel, unit) => `${fuel} (${unit})`,
    station: (fuel) => `${fuel}, gasolinera`,
    distance: (fuel) => `${fuel}, distancia`,
    updated: 'Última actualización de precios',
    hours: 'Horario',
  },
};

/** Fixed texts. */
export const TEXT = {
  waiting: {
    en: 'Waiting for the first price list…',
    fr: 'En attente de la première liste de prix…',
    de: 'Warte auf die erste Preisliste …',
    es: 'Esperando la primera lista de precios…',
  },
  unreachable: {
    en: 'The official price list cannot be read right now.',
    fr: 'La liste officielle des prix est illisible pour le moment.',
    de: 'Die offizielle Preisliste ist gerade nicht lesbar.',
    es: 'No se puede leer la lista oficial de precios en este momento.',
  },
  noPlace: {
    en: 'No place to search: locate your house in Gladys or enter a municipality.',
    fr: 'Aucun lieu de recherche : placez votre maison dans Gladys ou saisissez une commune.',
    de: 'Kein Suchort: lege den Standort deines Hauses in Gladys fest oder gib eine Gemeinde ein.',
    es: 'Ningún lugar de búsqueda: ubique su casa en Gladys o introduzca un municipio.',
  },
  noStation: {
    en: 'No station found around the house nor in the municipality.',
    fr: 'Aucune station trouvée autour de la maison ni dans la commune.',
    de: 'Keine Tankstelle um das Haus oder in der Gemeinde gefunden.',
    es: 'No se encontró ninguna gasolinera alrededor de la casa ni en el municipio.',
  },
  noPrice: {
    en: 'No price for the fuels followed.',
    fr: 'Aucun prix pour les carburants suivis.',
    de: 'Kein Preis für die verfolgten Kraftstoffe.',
    es: 'Ningún precio para los carburantes seguidos.',
  },
  delisted: {
    en: 'This station is no longer in the official list (closed?).',
    fr: 'Cette station n’est plus dans la liste officielle (fermée ?).',
    de: 'Diese Tankstelle ist nicht mehr in der offiziellen Liste (geschlossen?).',
    es: 'Esta gasolinera ya no figura en la lista oficial (¿cerrada?).',
  },
  otherCountry: {
    en: 'This device belongs to the other country: change the country in the configuration.',
    fr: 'Cet appareil appartient à l’autre pays : changez le pays dans la configuration.',
    de: 'Dieses Gerät gehört zum anderen Land: ändere das Land in der Konfiguration.',
    es: 'Este dispositivo pertenece al otro país: cambie el país en la configuración.',
  },
  hours: { en: 'Opening hours', fr: 'Horaires', de: 'Öffnungszeiten', es: 'Horario' },
  initFailed: {
    en: 'The integration could not start: see its logs.',
    fr: 'L’intégration n’a pas pu démarrer : voir ses journaux.',
    de: 'Die Integration konnte nicht starten: siehe ihre Protokolle.',
    es: 'La integración no pudo iniciarse: consulte sus registros.',
  },
};

/** Pick a language in a multi-language object, English as a fallback. */
export const pick = (texts, language) => texts[language] ?? texts.en;

export const fuelName = (fuel, language) => pick(FUELS[fuel].name, language);

/** "1.659 €" / "1,659 €": three decimals, as both sources publish them. */
export const formatPrice = (value, language) =>
  new Intl.NumberFormat(language, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);

/** "2.5 km" / "2,5 km" */
export const formatKm = (value, language) =>
  `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value)} km`;

/**
 * A local date and time of a source ("2026-11-12T22:20", the country's
 * time), or a day ("2026-11-11"), in the language: "12 nov. 2026 22:20", "Nov 12, 2026 22:20".
 */
export function formatLocal(value, language) {
  const [day, time] = String(value).split('T');
  const date = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${day}T00:00:00Z`),
  );
  return time ? `${date} ${time}` : date;
}

/** The name shown for a station: its brand, or its own name for an unbranded Italian one. */
export function stationLabel(station) {
  const brand = station.brand && station.brand !== 'Pompe Bianche' ? station.brand : '';
  return brand || station.name || station.brand || station.key;
}

/** "REPSOL – Avenida Levante, 15, Madrigueras", at most 80 characters. */
export function stationDeviceName(station) {
  const text = [stationLabel(station), [station.address, station.town].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' – ');
  return text.length > 80 ? `${text.slice(0, 79)}…` : text;
}

const each = (build) =>
  Object.fromEntries(LANGUAGES.map((language) => [language, build(language)]));

/** Texts built from values, in the four languages. */
export const MESSAGES = {
  /** Widget caption of the cheapest device: "Within 5 km · 12/11/2026 22:20". */
  within: (radiusKm, updated) =>
    each((l) => {
      const where = pick(
        {
          en: `Within ${radiusKm} km`,
          fr: `Dans un rayon de ${radiusKm} km`,
          de: `Im Umkreis von ${radiusKm} km`,
          es: `En un radio de ${radiusKm} km`,
        },
        l,
      );
      return updated ? `${where} · ${formatLocal(updated, l)}` : where;
    }),

  /** Widget caption of the cheapest device without a house: the municipality. */
  inTown: (town, updated) => each((l) => (updated ? `${town} · ${formatLocal(updated, l)}` : town)),

  /** The answer of the "Test the source" action. */
  testOk: ({ country, count, radiusKm, town, cheapest }) =>
    each((l) => {
      const found = pick(
        {
          en: `${pick(COUNTRY_NAMES[country], l)}: ${count} station(s) found`,
          fr: `${pick(COUNTRY_NAMES[country], l)} : ${count} station(s) trouvée(s)`,
          de: `${pick(COUNTRY_NAMES[country], l)}: ${count} Tankstelle(n) gefunden`,
          es: `${pick(COUNTRY_NAMES[country], l)}: ${count} gasolinera(s) encontrada(s)`,
        },
        l,
      );
      const where = [
        radiusKm
          ? pick(
              {
                en: `within ${radiusKm} km of the house`,
                fr: `à ${radiusKm} km de la maison`,
                de: `im Umkreis von ${radiusKm} km ums Haus`,
                es: `a ${radiusKm} km de la casa`,
              },
              l,
            )
          : null,
        town
          ? pick({ en: `in ${town}`, fr: `à ${town}`, de: `in ${town}`, es: `en ${town}` }, l)
          : null,
      ]
        .filter(Boolean)
        .join(pick({ en: ' or ', fr: ' ou ', de: ' oder ', es: ' o ' }, l));
      const best = cheapest
        ? `. ${fuelName(cheapest.fuel, l)} ${pick(
            {
              en: 'cheapest',
              fr: 'le moins cher',
              de: 'am günstigsten',
              es: 'más barato',
            },
            l,
          )}: ${formatPrice(cheapest.price, l)} (${stationLabel(cheapest.station)}).`
        : '.';
      return `${found} ${where}${best}`;
    }),
};
