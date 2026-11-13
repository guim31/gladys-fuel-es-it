// -----------------------------------------------------------------------------
// Reading the big official files in a stream, without keeping them in memory
// (the container has 256 MB): the Spanish list of all stations is a 12 MB JSON
// document, the Italian registry and price list are 4 MB CSV files. Each
// record is handed over as soon as it is read, and dropped unless selected.
// -----------------------------------------------------------------------------

/**
 * The text chunks of a response body, decoded as UTF-8.
 * @param {ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>} body
 */
async function* textChunks(body) {
  const decoder = new TextDecoder('utf-8');
  for await (const chunk of body) {
    yield decoder.decode(chunk, { stream: true });
  }
  const rest = decoder.decode();
  if (rest) {
    yield rest;
  }
}

/**
 * The lines of a text body, without their end of line.
 * @param {ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>} body
 */
export async function* lines(body) {
  let pending = '';
  for await (const text of textChunks(body)) {
    pending += text;
    let end;
    while ((end = pending.indexOf('\n')) >= 0) {
      yield pending.slice(0, end).replace(/\r$/, '');
      pending = pending.slice(end + 1);
    }
  }
  if (pending) {
    yield pending.replace(/\r$/, '');
  }
}

/**
 * The objects of the first array of a JSON document whose items are objects,
 * one at a time, plus what precedes the array (the "head", up to 4 KB) through
 * `onHead`. Strings are followed so a brace inside a text is not taken for one
 * of the structure.
 * @param {ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>} body
 * @param {(head: string) => void} [onHead]
 */
export async function* arrayObjects(body, onHead = () => {}) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  /** The depth of the array once entered, then -1 once left. */
  let arrayDepth = 0;
  let head = '';
  /** The text of the object being read, null between objects. */
  let item = null;
  for await (const text of textChunks(body)) {
    let start = 0;
    for (let i = 0; i < text.length; i += 1) {
      const c = text[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (c === '\\') {
          escaped = true;
        } else if (c === '"') {
          inString = false;
        }
        continue;
      }
      if (c === '"') {
        inString = true;
      } else if (c === '{' || c === '[') {
        depth += 1;
        if (c === '[' && arrayDepth === 0) {
          arrayDepth = depth;
          onHead(head + text.slice(0, i));
          head = null;
        } else if (c === '{' && arrayDepth > 0 && depth === arrayDepth + 1) {
          item = '';
          start = i;
        }
      } else if (c === '}' || c === ']') {
        if (item !== null && depth === arrayDepth + 1) {
          const raw = item + text.slice(start, i + 1);
          item = null;
          yield JSON.parse(raw);
        } else if (depth === arrayDepth) {
          arrayDepth = -1;
        }
        depth -= 1;
      }
    }
    if (item !== null) {
      item += text.slice(start);
    } else if (head !== null && head.length < 4096) {
      head += text.slice(0, 4096 - head.length);
    }
  }
}
