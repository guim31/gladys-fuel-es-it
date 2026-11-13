# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-13

### Added

- Fuel prices at the stations of Spain (Ministry for the Ecological Transition, every 30 minutes)
  and Italy (MIMIT open data, daily), without account nor key.
- Stations within a radius of the house located in Gladys, and/or of a municipality, listed in
  Discovery: per station added, the price of each fuel followed, the last price update and the
  opening hours (Spain).
- A "Cheapest fuel" device: per fuel, the lowest price within the radius, the station and its
  distance.
- A "Fuel price drop" scene trigger and a "Fuel prices" dashboard widget.
- A "Test the official price list" action.
- Texts and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-fuel-es-it/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-fuel-es-it/releases/tag/v1.0.0
