/* Drift lock: NETTA.SONAR.html carries the engine, the core and the island inline.
   Run from the repo root: node --test */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ISLAND_BYTES = 447545;
const ISLAND_SHA256 = '02c08152e281d28e48e17a2b6813bb693dfa255c94f30e033137409d0e8b5cfb';

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f));
const html = read('NETTA.SONAR.html');

/* bytes after the '>' of <script id="ID" type="text/plain"> up to that block's </script> */
function block(id) {
  const tag = Buffer.from(`<script id="${id}" type="text/plain">`);
  const at = html.indexOf(tag);
  assert.ok(at >= 0, `#${id}: opening tag not found in NETTA.SONAR.html`);
  assert.strictEqual(html.indexOf(tag, at + 1), -1, `#${id}: opening tag occurs more than once`);
  const start = at + tag.length, end = html.indexOf('</script>', start);
  assert.ok(end >= 0, `#${id}: no closing </script>`);
  return html.subarray(start, end);
}

function identical(id, file) {
  const a = block(id), b = read(file);
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  assert.ok(a.equals(b), `#${id} drifted from ${file}: ${a.length} vs ${b.length} B, first difference at byte ${i}`);
}

test('#engine is byte-identical to netta_engine.js', () => identical('engine', 'netta_engine.js'));
test('#core is byte-identical to sonar_core.js', () => identical('core', 'sonar_core.js'));

test(`#island decodes to netta.txt, ${ISLAND_BYTES} B, sha256 ${ISLAND_SHA256}`, () => {
  /* the page's own decoder: whitespace stripped, then atob (NETTA.SONAR.html, b64()) */
  let bin;
  try { bin = atob(block('island').toString('utf8').replace(/\s+/g, '')); }
  catch (e) { assert.fail(`#island is not valid base64: ${e.message}`); }
  const bytes = Buffer.from(bin, 'latin1');
  assert.strictEqual(bytes.length, ISLAND_BYTES, `#island decodes to ${bytes.length} B, pinned ${ISLAND_BYTES}`);
  assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), ISLAND_SHA256,
    '#island sha256 drifted from canonical netta.txt');
});
