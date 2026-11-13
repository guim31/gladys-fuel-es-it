# Fuel prices Spain & Italy

Fuel prices at the stations of **Spain** and **Italy**, from the official open
data of both governments, without account nor key. Not affiliated with either
ministry.

## What you get

- The stations around your house (or in a municipality) listed in the
  **Discovery** tab: add the ones you use, each becomes a device with its
  prices.
- A **Cheapest fuel** device: for each fuel followed, the lowest price within
  the radius, the station and its distance.
- A **Fuel price drop** scene trigger, and a **Fuel prices** dashboard widget.

## Requirements

- Gladys Assistant 5.3.0 or later.
- Internet access from Gladys (the sources are the ministries' servers).
- Your house located in Gladys (**Settings → Houses**), or a municipality in
  the configuration. On install, Gladys asks your permission to share the
  house location with the integration: it is used only to measure distances,
  inside the container.

## Installation

In Gladys, **Integrations → Install from GitHub**, address
`https://github.com/guim31/gladys-fuel-es-it`.

## Configuration

- **Country**: Spain or Italy (one per installation).
- **Fuels to follow**: Spain: unleaded 95 and 98, diesel (Gasóleo A), premium
  diesel, LPG. Italy: petrol and diesel, self-service and served apart, LPG,
  methane (per kg). Only the fuels of the chosen country are used.
- **Search radius**: 1 to 30 km around the first located house of Gladys
  (5 km by default).
- **Municipality** (optional): its stations are listed too, and without a
  located house the cheapest price is searched there. Case and accents do not
  matter (`Alcala de Henares`, `ROMA`).
- **Language of the names**: names of the devices and features, written once
  when a device is added, dates and trigger texts.

Then open **Discovery**: the cheapest device comes first, then the stations
from the nearest (50 at most), then those of the municipality.

## Devices

### Station

One per station added: the price of each fuel followed it sells (€/l, €/kg
for methane), the last price update (local time of the country), and the
opening hours in Spain. A station that sells a new fuel shows **Update** in
Discovery. A station that leaves the official list (closed) keeps its last
values, and the widget says so.

### Cheapest fuel

For each fuel followed: the lowest price within the radius, the station and
its distance in km (without a located house: in the municipality, no
distance). Spanish stations restricted to their members (cooperatives) are
never counted.

## Scenes

### Price under a threshold

A plain Gladys scene: trigger **A device value changes** on a price feature,
condition "below 1.60". It works for a station and for the cheapest device.

### Fuel price drop

The integration's trigger: a price falls on a station added in Gladys, or on
the cheapest device. Filters: the device and the fuels (empty: any). The
following actions can read `{{triggerEvent.data.fuel_name}}`, `station`,
`price`, `previous_price` and `drop` (in €). The first price seen after
adding a device is only remembered.

## Dashboard

### Fuel prices widget

The prices of a station added in Gladys, or by default those of the cheapest
device, one tile per fuel (six at most). Details, hidden by a setting: the
station and distance of each cheapest price, or the opening hours of a
station.

## Actions

**Test the official price list**: reads the list now and says how many
stations are found and the cheapest price.

## Data and limits

- **Spain**: REST service of the Ministry for the Ecological Transition
  ([Geoportal Gasolineras](https://geoportalgasolineras.es/)), updated every 30
  minutes. The integration reads the provinces of your stations every 30
  minutes, and the full list (12 MB, read in a stream) once a day.
- **Italy**: open data of the Ministry of Enterprises and Made in Italy
  ([MIMIT](https://www.mimit.gov.it/it/open-data/elenco-dataset/carburanti-prezzi-praticati-e-anagrafica-degli-impianti)),
  two files a day with the prices in force the day before at 8:00. They are
  asked every 2 hours, and downloaded only when new. No opening hours there.
- The prices are those declared by the stations to the ministries: a station
  late with its declaration shows an old price (see the last update).
- One country and one house per installation. Developed without a station of
  its own: feedback welcome.

## Troubleshooting

- **"No place to search"**: locate your house in Gladys, or enter a
  municipality, then save the configuration again.
- **No station in Discovery**: widen the radius, check the spelling of the
  municipality (its name in the official list: `Roma`, `Milano`), then use
  **Test the official price list**.
- **"The official price list cannot be read"**: the ministry's server is down
  or slow; the integration tries again every 30 minutes.
- Logs: set `LOG_LEVEL=debug` to see each read.

## Credits

Data: Ministerio para la Transición Ecológica y el Reto Demográfico (Spain)
and Ministero delle Imprese e del Made in Italy (Italy), open data. Inspired by
the Home Assistant community integrations for these sources. Not affiliated
with either ministry.
