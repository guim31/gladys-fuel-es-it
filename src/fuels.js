// -----------------------------------------------------------------------------
// The two countries and the fuels followed in each, with the name the official
// source gives them. A fuel key is a manifest option and a feature key: it
// must never change.
//
// Spain: one price per fuel and station (the "Precio …" fields of the
// Ministry's REST service). Italy: a price per fuel and per service mode,
// self-service ("isSelf" 1) or served (0); LPG and methane are nearly always
// served, so a single price is kept for them, the lowest of the two modes.
// -----------------------------------------------------------------------------

export const COUNTRIES = ['es', 'it'];

/**
 * @type {Record<string, { country: string, source: string, self?: boolean,
 *   unit?: string, name: Record<string, string> }>}
 */
export const FUELS = {
  gasolina_95: {
    country: 'es',
    source: 'Precio Gasolina 95 E5',
    name: { en: 'Unleaded 95', fr: 'Sans plomb 95', de: 'Super 95', es: 'Gasolina 95' },
  },
  gasolina_98: {
    country: 'es',
    source: 'Precio Gasolina 98 E5',
    name: { en: 'Unleaded 98', fr: 'Sans plomb 98', de: 'Super Plus 98', es: 'Gasolina 98' },
  },
  gasoleo_a: {
    country: 'es',
    source: 'Precio Gasoleo A',
    name: { en: 'Diesel', fr: 'Gazole', de: 'Diesel', es: 'Gasóleo A' },
  },
  gasoleo_premium: {
    country: 'es',
    source: 'Precio Gasoleo Premium',
    name: {
      en: 'Premium diesel',
      fr: 'Gazole premium',
      de: 'Premium-Diesel',
      es: 'Gasóleo Premium',
    },
  },
  glp: {
    country: 'es',
    source: 'Precio Gases licuados del petróleo',
    name: { en: 'LPG', fr: 'GPL', de: 'Autogas', es: 'GLP' },
  },
  benzina_self: {
    country: 'it',
    source: 'Benzina',
    self: true,
    name: {
      en: 'Petrol, self-service',
      fr: 'Essence, libre-service',
      de: 'Benzin, SB',
      es: 'Gasolina, autoservicio',
    },
  },
  benzina_served: {
    country: 'it',
    source: 'Benzina',
    self: false,
    name: {
      en: 'Petrol, served',
      fr: 'Essence, servie',
      de: 'Benzin, bedient',
      es: 'Gasolina, atendida',
    },
  },
  gasolio_self: {
    country: 'it',
    source: 'Gasolio',
    self: true,
    name: {
      en: 'Diesel, self-service',
      fr: 'Gazole, libre-service',
      de: 'Diesel, SB',
      es: 'Gasóleo, autoservicio',
    },
  },
  gasolio_served: {
    country: 'it',
    source: 'Gasolio',
    self: false,
    name: {
      en: 'Diesel, served',
      fr: 'Gazole, servi',
      de: 'Diesel, bedient',
      es: 'Gasóleo, atendido',
    },
  },
  gpl: {
    country: 'it',
    source: 'GPL',
    name: { en: 'LPG', fr: 'GPL', de: 'Autogas', es: 'GLP' },
  },
  metano: {
    country: 'it',
    source: 'Metano',
    unit: '€/kg',
    name: { en: 'Methane (CNG)', fr: 'Méthane (GNV)', de: 'Erdgas (CNG)', es: 'Metano (GNC)' },
  },
};

/** The price unit shown: per litre, per kg for methane. */
export const unitOf = (fuel) => FUELS[fuel].unit ?? '€/l';

export const FUEL_KEYS = Object.keys(FUELS);

/** The fuels of a country among `followed`, in the manifest order. */
export const fuelsOf = (country, followed = FUEL_KEYS) =>
  FUEL_KEYS.filter((key) => FUELS[key].country === country && followed.includes(key));
