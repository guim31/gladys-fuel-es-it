// -----------------------------------------------------------------------------
// The integration, wired on a Gladys client (the real one in index.js, the
// SDK's fake Gladys in the tests).
//
// Place: the first located house of Gladys (getHouses(), manifest
// `location: true`), a radius around it, and/or a municipality.
//
// Refresh: no core polling (should_poll false); the container ticks every
// 5 minutes on its own timer and reads the official source when due:
//   - Spain, every 30 minutes (the Ministry's own cadence): the provinces the
//     selection lies in, and once a day the full list (12 MB, read in a
//     stream) to find these provinces again;
//   - Italy, every 2 hours, with the ETag of both files (one new pair a day);
//   - 30 minutes after a failure; at once when the place or country changes.
// Every tick publishes the states that changed, each value sent again at least
// every 12 hours (heartbeat). A lower price on a device added in Gladys fires
// the "Fuel price drop" trigger.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import {
  CHEAPEST,
  STATION,
  buildCheapestDevice,
  buildStationDevice,
  cheapestIds,
  cheapestOf,
  cheapestStates,
  parseDeviceId,
  stationIds,
  stationStates,
} from './devices.js';
import { createSelector } from './geo.js';
import { MESSAGES, TEXT, fuelName, pick, stationLabel } from './i18n.js';
import { createIssueLog } from './issues.js';
import { readItaly } from './italy.js';
import { SourceError, readSpain } from './spain.js';
import { Store } from './store.js';
import { WIDGET_KEY, buildWidgetContent, normalizeSettings } from './widgets.js';

const logger = createLogger({ name: 'fuel-es-it' });

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
export const TICK_MS = 5 * MINUTE_MS;
export const REFRESH_MS = { es: 30 * MINUTE_MS, it: 2 * HOUR_MS };
export const FULL_READ_MS = 24 * HOUR_MS;
export const FAILURE_RETRY_MS = 30 * MINUTE_MS;
export const HEARTBEAT_MS = 12 * HOUR_MS;
/** The discovery list: the nearest stations, then the municipality's. */
export const MAX_DISCOVERED = 50;

export const ACTION_KEY = 'test_source';
export const PRICE_DROP = 'price_drop';
export const TRIGGER_KEYS = [PRICE_DROP];

/**
 * @param {object} gladys GladysIntegration, or the SDK's fake Gladys
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {Store} [options.store]
 * @param {() => number} [options.now]
 * @param {boolean} [options.timers] run the timer
 */
export function registerHandlers(
  gladys,
  {
    fetch: fetchImpl = globalThis.fetch,
    store = new Store(),
    now = () => Date.now(),
    timers = true,
  } = {},
) {
  let config = normalizeConfig(gladys.config ?? {});
  /** The first located house: { lat, lon } or null. */
  let home = null;
  /** What /data keeps: the last price seen per device and fuel (the trigger). */
  let persisted = { prices: {} };
  /** The selected stations of the last read, by key, and the list's date. */
  let snapshot = null;
  /** The place and country of the last read: another one reads everything again. */
  let readKey = null;
  let attemptAt = -Infinity;
  let failure = null;
  let provinces = null;
  let fullReadAt = -Infinity;
  let italyCache = null;
  let lastStatus = null;
  let firstRead = true;
  const delisted = new Set();
  let timer = null;
  let stopped = false;
  let ticking = null;

  const readIssues = createIssueLog(logger);
  const gladysIssues = createIssueLog(logger);

  const ready = store.load().then((data) => {
    persisted = { prices: data.prices && typeof data.prices === 'object' ? data.prices : {} };
  });

  // --- What is followed -------------------------------------------------------

  /** The devices added in Gladys, parsed: [{ kind, key, device }]. */
  const created = () =>
    (gladys.devices ?? [])
      .map((device) => ({ ...parseDeviceId(gladys, device.external_id), device }))
      .filter((entry) => entry.kind);

  const keptStations = () =>
    new Set(
      created()
        .filter((e) => e.kind === STATION && e.key.startsWith(`${config.country}-`))
        .map((e) => e.key),
    );

  const placeKey = () =>
    JSON.stringify([config.country, home, config.radiusKm, config.town.toLowerCase()]);
  const hasPlace = () => home !== null || config.town !== '';

  function nextReadAt() {
    if (!hasPlace() && keptStations().size === 0) {
      return Infinity;
    }
    if (failure) {
      return failure.retryAt;
    }
    if (readKey !== placeKey()) {
      return attemptAt === -Infinity ? now() : attemptAt + MINUTE_MS;
    }
    return attemptAt + REFRESH_MS[config.country];
  }

  const cheapest = () =>
    snapshot ? cheapestOf([...snapshot.stations.values()], config, home !== null) : {};

  // --- Reading the source -----------------------------------------------------

  /** @returns {Promise<boolean>} new data was read */
  async function refresh() {
    attemptAt = now();
    const key = placeKey();
    if (key !== readKey) {
      provinces = null;
      italyCache = null;
    }
    const select = createSelector({
      home,
      radiusKm: config.radiusKm,
      town: config.town,
      keep: keptStations(),
    });
    try {
      let result;
      let full = false;
      if (config.country === 'es') {
        full = provinces === null || now() - fullReadAt >= FULL_READ_MS;
        result = await readSpain(fetchImpl, { select, provinces: full ? null : provinces });
        if (full) {
          provinces = result.provinces;
          fullReadAt = now();
        }
        result.changed = true;
      } else {
        result = await readItaly(fetchImpl, { select, cache: italyCache });
        // New files (once a day): the discovery list is published again.
        full = result.changed;
        italyCache = result.cache;
      }
      failure = null;
      readIssues.ok('read', 'The official price list answers again');
      const fresh = readKey !== key;
      readKey = key;
      if (!result.changed && snapshot) {
        return false;
      }
      snapshot = {
        country: config.country,
        stations: new Map(result.stations.map((s) => [s.key, s])),
        updated: result.updated,
      };
      if (firstRead || fresh) {
        firstRead = false;
        logger.info(
          `Official ${config.country.toUpperCase()} list read: ${snapshot.stations.size} station(s) selected`,
        );
      }
      logger.debug(`List of ${snapshot.updated}: ${snapshot.stations.size} station(s)`);
      if (full || fresh) {
        checkDelisted();
        await publishDiscovery();
      }
      return true;
    } catch (err) {
      const error = err instanceof SourceError ? err : new SourceError(err.message);
      failure = { retryAt: attemptAt + FAILURE_RETRY_MS, error };
      readIssues.fail('read', `The official price list cannot be read: ${error.message}`);
      return false;
    }
  }

  /** A station added in Gladys and gone from the full list: said once. */
  function checkDelisted() {
    for (const key of keptStations()) {
      if (!snapshot.stations.has(key) && !delisted.has(key)) {
        delisted.add(key);
        logger.info(`Station ${key} is no longer in the official list (closed?)`);
      } else if (snapshot.stations.has(key)) {
        delisted.delete(key);
      }
    }
  }

  // --- Discovery --------------------------------------------------------------

  function discoveredDevices() {
    const devices = [];
    if (hasPlace()) {
      devices.push(buildCheapestDevice(gladys, config));
    }
    if (!snapshot || snapshot.country !== config.country) {
      return devices;
    }
    const stations = [...snapshot.stations.values()];
    const kept = keptStations();
    const listed = [
      ...stations.filter((s) => s.nearby).sort((a, b) => a.distanceKm - b.distanceKm),
      ...stations
        .filter((s) => s.inTown && !s.nearby)
        .sort((a, b) => stationLabel(a).localeCompare(stationLabel(b))),
    ]
      .filter((s) => !kept.has(s.key))
      .slice(0, MAX_DISCOVERED);
    for (const station of [...stations.filter((s) => kept.has(s.key)), ...listed]) {
      devices.push(buildStationDevice(gladys, config, station));
    }
    return devices;
  }

  async function publishDiscovery() {
    try {
      await gladys.publishDiscoveredDevices(discoveredDevices());
      gladysIssues.ok('discovery', 'Discovered stations accepted by Gladys again');
    } catch (err) {
      gladysIssues.fail('discovery', `Discovered stations not accepted by Gladys: ${err.message}`);
    }
  }

  // --- States and the trigger -------------------------------------------------

  /** Current prices of each device added: [{ device, prices: { fuel: { price, station } } }]. */
  function currentPrices() {
    if (!snapshot || snapshot.country !== config.country) {
      return [];
    }
    const best = cheapest();
    return created().flatMap(({ kind, key, device }) => {
      if (kind === CHEAPEST && key === config.country) {
        return [{ device, prices: best }];
      }
      const station = kind === STATION ? snapshot.stations.get(key) : null;
      if (!station) {
        return [];
      }
      const prices = {};
      for (const fuel of config.fuels) {
        if (station.prices[fuel] !== undefined) {
          prices[fuel] = { price: station.prices[fuel], station };
        }
      }
      return [{ device, prices }];
    });
  }

  /**
   * A lower price than the last one seen on a device added in Gladys: one
   * event per device and fuel. The first price seen is only remembered.
   */
  function drops() {
    const events = [];
    const seen = {};
    for (const { device, prices } of currentPrices()) {
      const before = persisted.prices[device.external_id] ?? {};
      seen[device.external_id] = {};
      for (const [fuel, { price, station }] of Object.entries(prices)) {
        seen[device.external_id][fuel] = price;
        const previous = before[fuel];
        if (typeof previous === 'number' && price < previous - 1e-9) {
          events.push({
            device: device.external_id,
            fuel,
            fuel_name: fuelName(fuel, config.language),
            station: `${stationLabel(station)}, ${station.town}`,
            price,
            previous_price: previous,
            drop: Math.round((previous - price) * 1000) / 1000,
          });
        }
      }
    }
    // Devices gone, or of the other country: kept as they were.
    const prices = { ...persisted.prices, ...seen };
    for (const id of Object.keys(prices)) {
      if (!(gladys.devices ?? []).some((device) => device.external_id === id)) {
        delete prices[id];
      }
    }
    if (JSON.stringify(prices) !== JSON.stringify(persisted.prices)) {
      persisted.prices = prices;
      store.save(persisted);
    }
    return events;
  }

  /** Remembered even when Gladys refuses the event: never fired in a loop. */
  async function sendEvents(events) {
    for (const event of events) {
      try {
        await gladys.publishSceneEvent(PRICE_DROP, event);
        logger.debug(`Trigger ${PRICE_DROP}: ${JSON.stringify(event)}`);
      } catch (err) {
        gladysIssues.fail(
          'scene-event',
          `Trigger ${PRICE_DROP} not sent to Gladys: ${err.message}`,
        );
      }
    }
  }

  async function publishStates() {
    if (!snapshot || snapshot.country !== config.country) {
      return;
    }
    const states = created().flatMap(({ kind, key }) => {
      if (kind === CHEAPEST && key === config.country) {
        return cheapestStates(gladys, config, cheapest());
      }
      const station = kind === STATION ? snapshot.stations.get(key) : null;
      return station ? stationStates(gladys, config, station) : [];
    });
    if (states.length === 0) {
      return;
    }
    try {
      const { count } = await gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
      if (count > 0) {
        logger.debug(`${count} state(s) published`);
      }
      gladysIssues.ok('states', 'States accepted by Gladys again');
    } catch (err) {
      gladysIssues.fail('states', `States not accepted by Gladys: ${err.message}`);
    }
  }

  const status = () => {
    if (!hasPlace() && keptStations().size === 0) {
      return 'noPlace';
    }
    if (failure) {
      return 'failing';
    }
    return snapshot && snapshot.country === config.country ? 'ok' : 'waiting';
  };

  /** The application status of the Configuration screen, sent on change only. */
  async function reportStatus() {
    const current = status();
    const value =
      current === 'failing'
        ? { connected: false, message: TEXT.unreachable }
        : current === 'noPlace'
          ? { connected: false, message: TEXT.noPlace }
          : { connected: true };
    const key = JSON.stringify(value);
    if (key === lastStatus) {
      return;
    }
    try {
      // The four languages: the core 5.2+ refuses a plain string.
      await gladys.setConnectionStatus(value.connected, value.message);
      lastStatus = key;
    } catch (err) {
      logger.debug(`Connection status not sent: ${err.message}`);
    }
  }

  // --- The tick ---------------------------------------------------------------

  /**
   * Read the source when due, publish what changed. One tick at a time: a
   * second caller waits for the one in progress.
   * @param {object} [options]
   * @param {boolean} [options.force] read now
   */
  async function tick({ force = false } = {}) {
    while (force && ticking) {
      await ticking.catch(() => {});
    }
    if (ticking) {
      return ticking;
    }
    ticking = (async () => {
      if (gladys.connected === false) {
        logger.debug('Gladys unreachable: tick skipped');
        return;
      }
      let read = false;
      if ((force && (hasPlace() || keptStations().size > 0)) || now() >= nextReadAt()) {
        read = await refresh();
      }
      await publishStates();
      if (read) {
        await sendEvents(drops());
        gladys.requestWidgetRefresh(WIDGET_KEY);
      }
      await reportStatus();
    })().finally(() => {
      ticking = null;
    });
    return ticking;
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped) {
      return;
    }
    timer = setTimeout(async () => {
      timer = null;
      try {
        await tick();
      } catch (err) {
        logger.error(`Refresh failed (${err.message})`);
      } finally {
        schedule();
      }
    }, TICK_MS);
  }

  async function locate() {
    try {
      const house = (await gladys.getHouses()).find(
        (h) => typeof h.latitude === 'number' && typeof h.longitude === 'number',
      );
      home = house ? { lat: house.latitude, lon: house.longitude } : null;
      if (!house) {
        logger.info('No located house in Gladys: the municipality only');
      }
    } catch (err) {
      home = null;
      logger.warn(`Houses of Gladys not readable (${err.message}): the municipality only`);
    }
  }

  /** (Re)start: locate the house, publish the cheapest device, read, then tick. */
  async function start() {
    await ready;
    stopped = false;
    lastStatus = null;
    failure = null;
    await locate();
    await publishDiscovery();
    schedule();
    await tick({ force: true });
  }

  // --- Handlers ---------------------------------------------------------------

  gladys.onScanRequest(async () => {
    await locate();
    if (readKey !== placeKey()) {
      await tick({ force: true });
    }
    await gladys.publishDiscoveredDevices(discoveredDevices());
  });

  // A device just added: its states again now (the core dropped the ones it
  // received before the feature existed), and its first prices remembered.
  const onDeviceAdded = async () => {
    await ticking?.catch(() => {});
    await publishStates();
    await sendEvents(drops());
    gladys.requestWidgetRefresh(WIDGET_KEY);
  };
  gladys.onDeviceCreated(onDeviceAdded);
  gladys.onDeviceUpdated(onDeviceAdded);
  gladys.onDeviceDeleted(() => gladys.requestWidgetRefresh(WIDGET_KEY));

  gladys.onAction(ACTION_KEY, async () => {
    logger.info('Action: test the official price list');
    await locate();
    if (!hasPlace()) {
      throw new Error(pick(TEXT.noPlace, config.language));
    }
    failure = null;
    await tick({ force: true });
    if (failure) {
      throw new Error(pick(TEXT.unreachable, config.language));
    }
    const stations = [...(snapshot?.stations.values() ?? [])].filter((s) => s.nearby || s.inTown);
    const best = cheapest();
    const fuel = config.fuels.find((f) => best[f]);
    return pick(
      MESSAGES.testOk({
        country: config.country,
        count: stations.length,
        radiusKm: home ? config.radiusKm : null,
        town: config.town,
        cheapest: fuel ? { fuel, ...best[fuel] } : null,
      }),
      config.language,
    );
  });

  gladys.onWidgetGet(WIDGET_KEY, async ({ settings, language }) => {
    const normalized = normalizeSettings(settings);
    const parsed = normalized.device ? parseDeviceId(gladys, normalized.device) : null;
    let target;
    if (parsed && !parsed.key.startsWith(config.country)) {
      target = { kind: 'otherCountry' };
    } else if (parsed?.kind === STATION) {
      const device = (gladys.devices ?? []).find((d) => d.external_id === normalized.device);
      const station = snapshot?.stations.get(parsed.key) ?? null;
      target = {
        kind: 'station',
        station,
        title: device?.name ?? (station && stationLabel(station)),
      };
    } else {
      target = {
        kind: 'cheapest',
        cheapest: cheapest(),
        located: home !== null,
        radiusKm: config.radiusKm,
        town: config.town,
        updated: snapshot?.updated ?? null,
      };
    }
    return buildWidgetContent({
      target,
      fuels: config.fuels,
      showDetails: normalized.showDetails,
      status: status(),
      language,
    });
  });

  gladys.onConfigUpdated(async (raw) => {
    config = normalizeConfig(raw);
    logger.info('New configuration received');
    await start();
  });

  gladys.on('connected', async () => {
    try {
      config = normalizeConfig(await gladys.getConfig());
      await start();
    } catch (err) {
      logger.error(`Post-connection initialization failed: ${err.message}`);
      await gladys.setConnectionStatus(false, TEXT.initFailed).catch(() => {});
    }
  });

  return {
    ready,
    tick,
    nextReadAt,
    /** For the tests: what the integration holds. */
    get snapshot() {
      return snapshot;
    },
    get prices() {
      return persisted.prices;
    },
    get home() {
      return home;
    },
    /** Stop the timer and wait for the last write under /data. */
    async stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
      await ticking?.catch(() => {});
      await store.flush();
    },
  };
}

export { cheapestIds, stationIds };
