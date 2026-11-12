# Fuel prices Spain & Italy for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com): fuel prices at the
stations of **Spain** and **Italy**, from the official open data of both governments, without
account nor key. User documentation: [English](docs/en.md), [français](docs/fr.md),
[Deutsch](docs/de.md), [español](docs/es.md).

## Features

- The stations within a radius of the house located in Gladys, and/or in a municipality, listed in
  Discovery: each station added becomes a device with the price of each fuel followed, the last
  price update and, in Spain, the opening hours.
- A **Cheapest fuel** device: per fuel, the lowest price within the radius, the station and its
  distance (members-only Spanish stations excluded).
- Fuels: Spain — Gasolina 95 and 98, Gasóleo A and Premium, GLP; Italy — Benzina and Gasolio
  (self-service and served apart), GPL, Metano.
- A **Fuel price drop** scene trigger (device and fuel filters; new price, previous price, drop as
  variables) and a **Fuel prices** dashboard widget. A threshold is a plain Gladys scene on a price
  feature.
- Texts in English, French, German and Spanish.

## Requirements

- Gladys Assistant 5.3.0 or later, with Internet access.
- The house located in Gladys (the integration declares `location: true`), or a municipality in
  the configuration.

## Installation

In Gladys, **Integrations → Install from GitHub**, address
`https://github.com/guim31/gladys-fuel-es-it`, then choose the country, the fuels and the radius.

## How it works

- **Spain**: the REST service of the Ministry for the Ecological Transition
  (`sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes`), updated every 30 minutes. The full
  list (12 MB) is read in a stream once a day to find the provinces of the selected stations; those
  provinces are read every 30 minutes.
- **Italy**: the MIMIT open data, `anagrafica_impianti_attivi.csv` and `prezzo_alle_8.csv`
  (≈ 24 000 stations, prices in force the day before at 8:00), read in a stream and filtered on the
  fly, asked every 2 hours with their ETag. The search API of the Osservaprezzi website is not used:
  it is not a documented open data service.
- Nothing is kept in memory but the selected stations: about 100 MB of memory during a full read,
  within the 256 MB of the sandbox. No core polling: the container has its own timer.

## Limitations

- One country and one house (the first located) per installation.
- Prices are those the stations declare to the ministries; Italian prices are a day old.
- No opening hours in the Italian data.
- Developed without the hardware (no station of my own): feedback welcome.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the SDK's fake Gladys and fake sources serving real answers cut down
(`test/fixtures/`), never the network. See [`CLAUDE.md`](CLAUDE.md) for the project rules. Versions,
images and releases belong to the Release workflow (Actions → Release).

## Credits

- Ministerio para la Transición Ecológica y el Reto Demográfico (Spain), Geoportal de
  Hidrocarburos open data.
- Ministero delle Imprese e del Made in Italy (Italy), "Carburanti – prezzi praticati e anagrafica
  degli impianti" open data (IODL 2.0).
- The neighbouring integrations [gladys-carbu-com](https://github.com/William-De71/gladys-carbu-com),
  [gladys-prixcarburants](https://github.com/prohand/gladys-prixcarburants) and
  [gladys-tankerkoenig](https://github.com/LM1LC3N7/gladys-tankerkoenig) for the user experience;
  the architecture and tests follow [gladys-us-fuel-prices](https://github.com/guim31/gladys-us-fuel-prices).

## Disclaimer

This project is not affiliated with, endorsed or sponsored by the Spanish or Italian ministries.
The cover shows a generic fuel pump and the two national flags, not their logos.

## License

Apache-2.0
