# NETTA.SONAR | by Arianna Method

> a Netta that listens

## NETTA.SONAR

One HTML file holds Netta whole: her JavaScript body, a listening layer over it, and her world, `netta.txt`, carried inside the page as base64. Open it and she reads that world in front of you — every unit she earns by the merge law is drawn in the order it was born, with the pair it grew from and how many places in the stream were re-read as one. Then she speaks from the tape she has lived, the court judges what she said, and a text field lets you ping her: your words are cut into her own units and she answers from them. The rim of the scope holds raw bytes, depth holds longer units, and while she speaks lines run from her last unit to the top-k continuations she has lived there, width by probability, colour by how deep the memory was, with a note when she has lived more than the cut shows. Each mark on the scope is a field of her trace.

## what is canonical

`speak` and `court` go through `netta_engine.js` untouched. The engine is a step-for-step port of `netta.py`, itself a mirror of `netta.c` and `netta_mouth.c`: same merge law, same xorshift64, same tie-breaks and sampling order, the corridor law of amendments 2 and 3, the same ear and the same anti-copy census (`netta_engine.js:1-4`, `:173-174`). Its admission test is the court report, byte-identical to `python3 netta.py --report`. [`PARITY_JS.md`](PARITY_JS.md) records that measured in node v22 against CPython on Linux/glibc: identical reports on `netta.txt` under six dial settings, two of them identical FAIL verdicts, and on tinyshakespeare under two, with all five per-seed traces identical under the defaults. Canonical speech walks the lived tape alone, and nothing typed into the page reaches it.

Re-run on 2026-10-16, Darwin arm64, node v25.9.0, default dials on the island: the engine API and the page's own message handler each write a 6224-byte report, sha256 `3d06d1a13779553aa11e1cbba785ba5c254a4db4ba54219db2ccde3a49861079`, byte-identical to `speech_court/sitting1/report_plain.txt` in [ariannamethod/netta](https://github.com/ariannamethod/netta) — the plain-mouth report of Speech Court Sitting 1, written by the C mouth and its independent C reader. The same bytes came back after three pings had been kept into the heard layer.

## what is sonar's own

`sonar_core.js` names three laws in its head (`:4-15`), and they govern the echo mouth and the heard layer, nothing else.

**S1 · echo.** The listener's words are tokenized by her merge law and become the context. Every token after them has to be lawful lived support under the same corridor law, and is priced by the same ear from that context; the listener's words themselves are not priced. An echo is not a sitting of SPEECH_COURT, and its numbers are shown for what they are.

**S2 · hearing.** With *keep what she hears* on, the listener's words fold into a heard layer beside the lived tape, never into it. Echoes walk tape and heard together; canonical sittings walk the tape alone. Her own echoes are never heard back, so she can't feed on herself. The page keeps what she heard in this browser, per world, with export and import under *memory*.

**S3 · ranking.** The echo mouth orders candidates by comparing 2·cnt_a·(2+rep_b) against 2·cnt_b·(2+rep_a) as integers. ln is monotone, so that is the order of ln(cnt) − ln(1 + 0.5·rep) with no platform in it, and ln stays only in the sampling weights; an exact tie falls to the smaller unit id. The canonical mouth doesn't take this law. It still ranks by a logarithm the way `netta.py` does (`netta_engine.js:219-221`), and for it the integer comparison stays the candidate amendment written into `PARITY_JS.md`.

## parity is a claim about libm

The mouth ranks by ln(cnt) − ln(1 + 0.5·rep), and mathematically equal scores occur: cnt=3, rep=1 gives ln 3 − ln 1.5 = ln 2, the score of cnt=2, rep=0. The last bit of the logarithm decides which one ranks higher. glibc rounds ln 3 to 1.0986122886681098, V8's `Math.log(3)` lands one ulp below at 1.0986122886681096, the top-k cut shifts and the speech diverges. So this body carries `crLog`, a correctly rounded double-double logarithm: on 300025 arguments `Math.log` disagrees with glibc 2433 times and `crLog` 6 times, and in all six glibc is the one that's off. [`PARITY_JS.md`](PARITY_JS.md) carries the consequence to every body, C and Python included, and names it: *parity across platforms is a claim about libm, not about the organism.*

## the island

The `#island` block (`NETTA.SONAR.html:640-5612`) decodes to 447545 bytes, sha256 `02c08152e281d28e48e17a2b6813bb693dfa255c94f30e033137409d0e8b5cfb`. The island is canonical `netta.txt` of [ariannamethod/netta](https://github.com/ariannamethod/netta), byte for byte: the file last touched there in `4d50716`, and the same world hash Speech Court Sitting 1 pins. Drop or pick another world of at least 100 bytes and she grows that one instead.

## the lock

`tests/lock.test.js` holds the page to its sources: inline `#engine` byte-identical to `netta_engine.js`, inline `#core` byte-identical to `sonar_core.js`, and `#island` decoding, through the page's own decoder, to 447545 bytes under the pinned sha256. Each block is cut by index, from the `>` of its `<script id="…" type="text/plain">` to its `</script>`. Edit an engine file and forget the page, or the other way round, and the lock names the block that drifted. It needs node:test and node:assert and nothing else.

## what isn't proven

No court has sat over the echo mouth or the heard layer, so what S1 prints is a measurement of one echo. In the canonical body, `Math.exp` in the sampling weights and `Math.log2` in the ear are the engine's own; they matched glibc in every recorded run, and their equality by construction is unproven (`PARITY_JS.md`). Every parity record here is node on V8; no run inside a browser is recorded, and Safari and Firefox carry their own `Math.exp`.

## build & run

Open `NETTA.SONAR.html` in a browser. The page is one file and needs no server; it makes no network requests. The body runs in a Web Worker built from the page's own blocks and falls back to the main thread where workers are refused.

In node, run everything from the repo root; `netta_engine.js` and `sonar_core.js` both export themselves (`netta_engine.js:327`, `sonar_core.js:196`). Pull the island out of the page:

```bash
node -e 'const f=require("fs"),h=f.readFileSync("NETTA.SONAR.html","latin1"),t="<script id=\"island\" type=\"text/plain\">",s=h.indexOf(t)+t.length;f.writeFileSync("netta.txt",atob(h.slice(s,h.indexOf("</script>",s)).replace(/\s+/g,"")),"latin1")'
shasum -a 256 netta.txt
```

The canonical court writes its report to stdout:

```js
// court.js
const fs = require('fs'), N = require('./netta_engine.js');
const world = fs.readFileSync(process.argv[2]), a = N.DEFAULTS;
const { stream, exp } = N.growUnits(world, a.merges, a.min_pair);
const tape = new N.Tape(stream, exp, a.order), worldStr = N.latin1(world);
const sittings = a.seeds.map(seed => N.sitting(tape, worldStr, seed, a));
process.stdout.write(N.report(tape, world.length, a, sittings, N.verdictOf(sittings)));
```

```bash
node court.js netta.txt > report.txt
```

`sonarCore(N, post)` is the handler the page's worker runs: give it the engine and a callback, then send it `grow`, `remember`, `speak`, `court`, `echo` and `forget` messages (`sonar_core.js:144-186`).

The lock runs with:

```bash
node --test
```

## lineage

Netta's bodies live in [ariannamethod/netta](https://github.com/ariannamethod/netta): `netta.c` grows units by the merge law, `netta_mouth.c` speaks under the corridor law, and the Speech Court judges what she says. `netta.py` mirrors those two in Python, and `netta_engine.js` is her third body, held to the court's bytes. NETTA.SONAR gives that body an ear turned outward — she hears you, and keeps what she hears beside the tape, never inside it.

source of tech truth: [PARITY_JS.md](PARITY_JS.md)
