// -----------------------------------------------------------------------------
// The two readers on their own: the stream splitters, the odd lines of the
// Italian registry, the errors of the sources.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSelector, nameKey, parseLocalDate, parsePosition, parsePrice } from '../src/geo.js';
import { parsePriceLine, parseRegistryLine, readItaly } from '../src/italy.js';
import { SourceError, readList, ALL_URL } from '../src/spain.js';
import { arrayObjects, lines } from '../src/stream.js';
import { fixtureText } from './helpers/world.js';

/** A body cut every `size` bytes, through multi-byte characters. */
function* bytes(text, size) {
  const data = new TextEncoder().encode(text);
  for (let i = 0; i < data.length; i += size) {
    yield data.slice(i, i + size);
  }
}

const collect = async (iterable) => {
  const out = [];
  for await (const item of iterable) {
    out.push(item);
  }
  return out;
};

const everything = createSelector({ home: null, radiusKm: 1, town: '', keep: new Set() });

test('arrayObjects: every object of the array, whatever the cut, braces in strings included', async () => {
  const doc = {
    Fecha: '12/11/2026 22:20:20',
    ListaEESSPrecio: [{ a: 'x{y}"z', b: 'Ñandú [1]' }, { a: '\\', b: '' }, {}],
    Nota: '{ not an item }',
  };
  const text = JSON.stringify(doc).replaceAll('/', '\\/');
  for (const size of [1, 3, 7, 64, 100000]) {
    let head = null;
    const items = await collect(arrayObjects(bytes(text, size), (h) => (head = h)));
    assert.deepEqual(items, doc.ListaEESSPrecio, `size ${size}`);
    assert.match(head, /"Fecha":"12\\\/11\\\/2026 22:20:20"/);
  }
});

test('lines: CRLF and a last line without end', async () => {
  assert.deepEqual(await collect(lines(bytes('a|b\r\nc|é\nlast', 2))), ['a|b', 'c|é', 'last']);
});

test('the Italian registry: names holding a "|", missing positions', () => {
  const text = fixtureText('it-anagrafica.csv').split('\n');
  const odd = text.filter((line) => line.split('|').length > 10).map(parseRegistryLine);
  assert.ok(odd.length >= 2);
  for (const station of odd) {
    assert.match(station.name, /\|/);
    assert.ok(station.position, station.key);
    assert.match(station.province, /^[A-Z]{2}$/);
  }
  assert.equal(parseRegistryLine(text[0]), null); // "Estrazione del …"
  assert.equal(parseRegistryLine(text[1]), null); // the header
  assert.ok(
    text
      .slice(2)
      .filter(Boolean)
      .map(parseRegistryLine)
      .some((s) => s.position === null),
  );
});

test('the Italian price lines: self-service, served, LPG either way, the rest ignored', () => {
  assert.deepEqual(parsePriceLine('3464|Benzina|1.999|1|09/11/2026 20:00:06'), {
    id: '3464',
    fuels: ['benzina_self'],
    price: 1.999,
    updated: '2026-11-09T20:00',
  });
  assert.deepEqual(parsePriceLine('3464|Gasolio|2.1|0|09/11/2026 20:00:06').fuels, [
    'gasolio_served',
  ]);
  assert.deepEqual(parsePriceLine('3464|GPL|0.799|1|09/11/2026 20:00:06').fuels, ['gpl']);
  assert.equal(parsePriceLine('3464|Blue Diesel|2.3|1|09/11/2026 20:00:06'), null);
  assert.equal(parsePriceLine('3464|Benzina|0|1|09/11/2026 20:00:06'), null);
  assert.equal(parsePriceLine('idImpianto|descCarburante|prezzo|isSelf|dtComu'), null);
});

test('small parsers', () => {
  assert.equal(parsePrice('1,629'), 1.629);
  assert.equal(parsePrice(''), null);
  assert.equal(parsePrice('0,000'), null);
  assert.deepEqual(parsePosition('40,4', '-3,7'), { lat: 40.4, lon: -3.7 });
  assert.equal(parsePosition('0', '0'), null);
  assert.equal(parsePosition('', '12'), null);
  assert.equal(nameKey('Alcalá de Henares'), nameKey('ALCALA DE HENARES'));
  assert.equal(nameKey("L'Hospitalet de Llobregat"), 'l hospitalet de llobregat');
  assert.equal(parseLocalDate('1/2/2026 7:05:00'), '2026-02-01T07:05');
  assert.equal(parseLocalDate('soon'), null);
});

test('Spain: an HTTP error, a network error, an answer that is not the list', async () => {
  const fail = (response) => async () => response;
  await assert.rejects(
    readList(fail(new Response('no', { status: 500 })), ALL_URL, everything),
    (err) => err instanceof SourceError && err.status === 500,
  );
  await assert.rejects(
    readList(
      async () => {
        throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
      },
      ALL_URL,
      everything,
    ),
    /unreachable \(ECONNRESET\)/,
  );
  await assert.rejects(
    readList(fail(new Response('<html>maintenance</html>', { status: 200 })), ALL_URL, everything),
    /without its date/,
  );
});

test('Italy: a file that is not the price list', async () => {
  const fetchImpl = async () => new Response('<html>Errore</html>', { status: 200 });
  await assert.rejects(
    readItaly(fetchImpl, { select: everything, cache: null }),
    /without its date/,
  );
});
