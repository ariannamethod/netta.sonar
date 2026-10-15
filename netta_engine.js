/* NETTA — JavaScript body.
   Step-for-step port of netta.py (itself a mirror of netta.c + netta_mouth.c).
   Same merge law, same PRNG, same tie-breaks, same sampling order, same court.
   Admission test: byte-identical speech and court report against netta.py. */
(function (root) {
'use strict';

const BASE_UNITS = 256, PACK = 16, P = 65536;
const REP_WINDOW = 12, REP_PENALTY = 0.5, SPEAK_HARD = 256, MAX_EM = 65536;
const VOID_LINE = 0.50, MIN_MATCH = 32;
const PASS_LINE = 'SPEECH PASS: the mouth speaks below ignorance and above copying';

class Refusal extends Error {}

/* Correctly rounded natural log, double-double arithmetic.
   V8's Math.log is fdlibm: it can land one ulp off (Math.log(3) is), and the
   mouth's ranking compares values that are mathematically equal — ln3 − ln1.5
   against ln2 — so the last bit decides the top-k. glibc rounds correctly; so
   does this. */
const SPLIT = 134217729;
function twoSum(a, b) { const s = a + b, bb = s - a; return [s, (a - (s - bb)) + (b - bb)]; }
function twoProd(a, b) { const p = a * b;
  let t = SPLIT * a; const ah = t - (t - a), al = a - ah; t = SPLIT * b; const bh = t - (t - b), bl = b - bh;
  return [p, ((ah * bh - p) + ah * bl + al * bh) + al * bl]; }
function ddAdd(a, b) { let [s, e] = twoSum(a[0], b[0]); e += a[1] + b[1]; const h = s + e; return [h, e - (h - s)]; }
function ddMul(a, b) { let [p, e] = twoProd(a[0], b[0]); e += a[0] * b[1] + a[1] * b[0]; const h = p + e; return [h, e - (h - p)]; }
function ddDiv(a, b) { const q1 = a[0] / b[0]; let r = ddAdd(a, ddMul(b, [-q1, 0]));
  const q2 = r[0] / b[0]; r = ddAdd(r, ddMul(b, [-q2, 0])); const q3 = r[0] / b[0];
  let q = twoSum(q1, q2); q = ddAdd(q, [q3, 0]); return q; }
const LN2 = [0.6931471805599453, 2.3190468138462996e-17];
const _f = new Float64Array(1), _u = new Uint32Array(_f.buffer);
function crLog(x) {
  if (x === 1) return 0;
  _f[0] = x; let e = ((_u[1] >>> 20) & 0x7ff) - 1023;
  _u[1] = (_u[1] & 0x800fffff) | 0x3ff00000; let m = _f[0];
  if (m > Math.SQRT2) { m /= 2; e += 1; }
  const s = ddDiv([m - 1, 0], twoSum(m, 1)), s2 = ddMul(s, s);
  let t = s, acc = s;
  for (let k = 1; k < 30; k++) { t = ddMul(t, s2); if (Math.abs(t[0]) < 1e-40) break; acc = ddAdd(acc, ddDiv(t, [2 * k + 1, 0])); }
  const lm = [2 * acc[0], 2 * acc[1]];
  const r = ddAdd(ddMul([e, 0], LN2), lm);
  return r[0] + r[1];
}

/* xorshift64 — the entire source of chance */
const M64 = (1n << 64n) - 1n;
class Rng {
  constructor(state) { this.s = (BigInt.asUintN(64, BigInt(state)) & M64) || 1n; }
  next() {
    let x = this.s;
    x ^= (x << 13n) & M64;
    x ^= x >> 7n;
    x ^= (x << 17n) & M64;
    this.s = x;
    return x;
  }
  below(n) { return Number(this.next() % BigInt(n)); }
  double() { return Number(this.next() >> 11n) / 9007199254740992; }
}

/* min-heap over (-count, a, b): biggest count, then smaller a, then smaller b */
class Heap {
  constructor(items) { this.h = items; for (let i = (items.length >> 1) - 1; i >= 0; i--) this.down(i); }
  static lt(x, y) { return x[0] !== y[0] ? x[0] < y[0] : x[1] !== y[1] ? x[1] < y[1] : x[2] < y[2]; }
  push(v) { const h = this.h; h.push(v); let i = h.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (Heap.lt(h[i], h[p])) { [h[i], h[p]] = [h[p], h[i]]; i = p; } else break; } }
  pop() { const h = this.h, top = h[0], last = h.pop();
    if (h.length) { h[0] = last; this.down(0); } return top; }
  down(i) { const h = this.h, n = h.length;
    for (;;) { let m = i; const l = 2 * i + 1, r = l + 1;
      if (l < n && Heap.lt(h[l], h[m])) m = l; if (r < n && Heap.lt(h[r], h[m])) m = r;
      if (m === i) return; [h[i], h[m]] = [h[m], h[i]]; i = m; } }
  get size() { return this.h.length; }
}

/* Body 0: the merge law. onMerge(unitId, a, b, occurrences) lets a watcher see
   each unit born — the moment old bytes are re-read as one word. */
function growUnits(world, merges, minPair, onMerge) {
  const n = world.length;
  const sym = Int32Array.from(world);
  const prv = new Int32Array(n), nxt = new Int32Array(n);
  for (let i = 0; i < n; i++) { prv[i] = i - 1; nxt[i] = i + 1; }
  nxt[n - 1] = -1;
  const count = new Map(), where = new Map();
  for (let i = 0; i < n - 1; i++) {
    const k = sym[i] * P + sym[i + 1];
    count.set(k, (count.get(k) || 0) + 1);
    let w = where.get(k); if (!w) where.set(k, w = []); w.push(i);
  }
  const items = []; for (const [k, c] of count) items.push([-c, Math.floor(k / P), k % P]);
  const heap = new Heap(items);
  const bump = (k, d) => {
    const c = (count.get(k) || 0) + d;
    if (c) { count.set(k, c); if (d > 0) heap.push([-c, Math.floor(k / P), k % P]); }
    else count.delete(k);
  };
  const addWhere = (k, i) => { let w = where.get(k); if (!w) where.set(k, w = []); w.push(i); };
  const exp = []; for (let i = 0; i < BASE_UNITS; i++) exp.push(Uint8Array.of(i));
  while (exp.length - BASE_UNITS < merges) {
    let best = null;
    while (heap.size) {
      const [negc, a, b] = heap.pop();
      const live = count.get(a * P + b) || 0;
      if (live === -negc) { best = [live, a, b]; break; }
      if (live) heap.push([-live, a, b]);
    }
    if (best === null || best[0] < minPair) break;
    const [cnt, a, b] = best, nw = exp.length, ab = a * P + b;
    const e = new Uint8Array(exp[a].length + exp[b].length); e.set(exp[a]); e.set(exp[b], exp[a].length);
    exp.push(e);
    const pos = where.get(ab) || []; where.delete(ab);
    for (const i of pos) {
      if (sym[i] !== a) continue;
      const j = nxt[i];
      if (j < 0 || sym[j] !== b) continue;
      const left = prv[i], right = nxt[j];
      bump(ab, -1);
      if (left >= 0) { const sl = sym[left]; bump(sl * P + a, -1); bump(sl * P + nw, 1); addWhere(sl * P + nw, left); }
      if (right >= 0) { const sr = sym[right]; bump(b * P + sr, -1); bump(nw * P + sr, 1); addWhere(nw * P + sr, i); }
      sym[i] = nw; sym[j] = -1; nxt[i] = right;
      if (right >= 0) prv[right] = i;
    }
    if (onMerge) onMerge(nw, a, b, cnt);
  }
  const stream = []; for (let i = 0; i < n; i++) if (sym[i] >= 0) stream.push(sym[i]);
  return { stream, exp };
}

const startsUpper = e => e[0] >= 65 && e[0] <= 90;
const endsSentence = e => { const c = e[e.length - 1]; return c === 46 || c === 33 || c === 63 || c === 10; };

/* The lived stream and every n-gram actually walked.
   netta.py keeps sorted packed keys; here each level maps its prefix (≤48 bits,
   exact in a double) to continuations in ascending unit id — the same answer. */
class Tape {
  constructor(stream, exp, order, lenient) {
    this.stream = stream; this.exp = exp; this.order = order;
    const n = stream.length, n1 = new Int32Array(exp.length);
    for (const u of stream) n1[u]++;
    this.alive = []; this.uni = [];
    for (let u = 0; u < exp.length; u++) if (n1[u]) { this.alive.push(u); this.uni.push([u, n1[u]]); }
    const build = (len) => {
      const m = new Map();
      for (let i = 0; i + len < n; i++) {
        let p = 0; for (let k = 0; k < len; k++) p = p * P + stream[i + k];
        let t = m.get(p); if (!t) m.set(p, t = new Map());
        const tok = stream[i + len]; t.set(tok, (t.get(tok) || 0) + 1);
      }
      const out = new Map();
      for (const [p, t] of m) out.set(p, [...t.entries()].sort((x, y) => x[0] - y[0]));
      return out;
    };
    this.bi = build(1); this.tri = build(2); this.quad = order >= 4 ? build(3) : new Map();
    this.starts = [];
    for (let i = 0; i < n - 3; i++)
      if (startsUpper(exp[stream[i]]) && (i === 0 || endsSentence(exp[stream[i - 1]]))) this.starts.push(i);
    if (!this.starts.length && !lenient) throw new Refusal('no sentence starts');
  }
}

const EMPTY = [];
function support(tape, em, level, order) {
  const nem = em.length;
  if (level === 4) {
    if (order < 4 || nem < 3 || !tape.quad.size) return EMPTY;
    return tape.quad.get((em[nem - 3] * P + em[nem - 2]) * P + em[nem - 1]) || EMPTY;
  }
  if (level === 3) { if (nem < 2) return EMPTY; return tape.tri.get(em[nem - 2] * P + em[nem - 1]) || EMPTY; }
  if (level === 2) { if (nem < 1) return EMPTY; return tape.bi.get(em[nem - 1]) || EMPTY; }
  return tape.uni;
}

/* Amendment 2: one continuation is a rail; after K rails the mouth must branch.
   Amendment 3: the rail's own token is closed for that one choice. */
function lawfulSupport(tape, em, order, corridorK, corr) {
  let cand = EMPTY, level = 0;
  for (const lvl of [4, 3, 2, 1]) { cand = support(tape, em, lvl, order); if (cand.length) { level = lvl; break; } }
  if (!cand.length) throw new Refusal('empty lived support');
  if (cand.length >= 2) return [cand, level, null, 0];
  if (corridorK && corr >= corridorK) {
    const rail = cand[0][0];
    for (let lvl = level - 1; lvl > 0; lvl--) {
      const alt = support(tape, em, lvl, order);
      if (alt.length >= 2) {
        const admitted = alt.filter(c => c[0] !== rail);
        if (admitted.length === alt.length) throw new Refusal('lower support lost the corridor continuation');
        return [admitted, lvl, rail, 0];
      }
    }
  }
  return [cand, level, null, corridorK ? corr + 1 : corr];
}

function concat(parts) { let n = 0; for (const p of parts) n += p.length;
  const o = new Uint8Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; }

/* The mouth. onStep(step) receives every choice with its whole lived support —
   this is what the inner world is drawn from, nothing else. */
function speak(tape, seed, args, onStep) {
  const rng = new Rng(BigInt(seed) ^ 0x9E3779B97F4A7C15n);
  const sp = tape.starts[rng.below(tape.starts.length)];
  const em = [tape.stream[sp], tape.stream[sp + 1], tape.stream[sp + 2]];
  const parts = []; let outLen = 0; const trace = [];
  for (let k = 0; k < 3; k++) {
    const e = tape.exp[em[k]]; parts.push(e); outLen += e.length;
    trace.push(`${k}\t${em[k]}\t${sp + k}\t0\t0\t0\t0\t${e.length}\t0\t1\t0\t-`);
    if (onStep) onStep({ index: k, tok: em[k], opening: true, start: sp + k, level: 0, cand: [], chosen: 0 });
  }
  let corr = 0, want = args.bytes; const hard = args.bytes + SPEAK_HARD;
  while (outLen < want && em.length + 1 < MAX_EM) {
    const before = corr;
    let cand, level, veto;
    [cand, level, veto, corr] = lawfulSupport(tape, em, args.order, args.corridor, corr);
    const win = em.slice(-REP_WINDOW);
    let occ = 0; const scored = [];
    for (const [tok, cnt] of cand) {
      occ += cnt;
      let rep = 0; for (const w of win) if (w === tok) rep++;
      scored.push([tok, cnt, crLog(cnt + 1e-300) - crLog(1.0 + REP_PENALTY * rep)]);
    }
    scored.sort((x, y) => (y[2] - x[2]) || (x[0] - y[0]));
    const limit = Math.min(scored.length, args.topk);
    const weights = []; let top = -1e300;
    for (let i = 0; i < limit; i++) { const v = scored[i][2] / args.temp; weights.push(v); if (v > top) top = v; }
    let total = 0.0;
    for (let i = 0; i < limit; i++) { weights[i] = Math.exp(weights[i] - top); total += weights[i]; }
    const r = rng.double() * total;
    let cum = 0.0, at = 0;
    for (let i = 0; i < limit; i++) { cum += weights[i]; if (cum > r) { at = i; break; } }
    const [tok, cnt] = scored[at];
    const e = tape.exp[tok];
    em.push(tok); parts.push(e); outLen += e.length;
    trace.push(`${em.length - 1}\t${tok}\t-\t${level}\t${cand.length}\t${occ}\t${cnt}\t${e.length}\t0\t1\t${before}\t${veto === null ? '-' : veto}`);
    if (onStep) onStep({ index: em.length - 1, tok, level, cand, occ, chosen: cnt, veto, corridor: before,
      probs: weights.map(w => w / total), ranked: scored.slice(0, limit).map(s => s[0]) });
    if (outLen >= want && !endsSentence(e) && outLen < hard) want = outLen + 1;
  }
  return { speech: concat(parts), tokens: em, trace };
}

/* The court's ear: re-derives every support from the tokens alone. */
function ear(tape, tokens, order, corridorK) {
  let model = 0.0, ignorance = 0.0;
  const perToken = Math.log2(tape.alive.length);
  const past = []; let corr = 0;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    let cand;
    if (i < 3) {
      cand = EMPTY;
      for (let lvl = i >= 2 ? 3 : i + 1; lvl > 0; lvl--) { cand = support(tape, past, lvl, order); if (cand.length) break; }
    } else {
      let _l, _v; [cand, _l, _v, corr] = lawfulSupport(tape, past, order, corridorK, corr);
    }
    let occ = 0, chosen = 0;
    for (const [t, c] of cand) { occ += c; if (t === tok) chosen = c; }
    if (!chosen) throw new Refusal('emitted token is outside lawful lived support');
    model += -Math.log2(chosen / occ);
    ignorance += perToken;
    past.push(tok);
  }
  return { model, ignorance };
}

/* Anti-copy census: coverage by verbatim world runs of 32 bytes or more.
   Bytes are carried as latin-1 strings so that `includes` is byte-exact. */
const latin1 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return s; };
function census(speech, worldStr) {
  const s = latin1(speech), sn = s.length, covered = new Uint8Array(sn);
  let longest = 0, z = 0;
  for (let at = 0; at < sn; at++) {
    const remain = sn - at;
    z = Math.min(z ? z - 1 : 0, remain);
    while (z < remain && worldStr.includes(s.substring(at, at + z + 1))) z++;
    if (z > longest) longest = z;
    if (z >= MIN_MATCH) covered.fill(1, at, at + z);
  }
  let c = 0; for (const v of covered) c += v;
  return { longest, coverage: c / sn };
}

const DEFAULTS = { seeds: [7, 19, 42, 101, 271], merges: 4096, min_pair: 4, order: 4, bytes: 700, temp: 0.8, topk: 15, corridor: 1 };

function sitting(tape, worldStr, seed, args, onStep) {
  const { speech, tokens, trace } = speak(tape, seed, args, onStep);
  const { model, ignorance } = ear(tape, tokens, args.order, args.corridor);
  const { longest, coverage } = census(speech, worldStr);
  const modelBpb = model / speech.length, ignoranceBpb = ignorance / speech.length;
  const earOk = modelBpb < ignoranceBpb, copyOk = coverage < VOID_LINE;
  return { seed, speech, tokens, trace, model, ignorance, modelBpb, ignoranceBpb, longest, coverage, earOk, copyOk, pass: earOk && copyOk };
}

function line(s) {
  const f = (v, d) => v.toFixed(d);
  return `seed=${s.seed}\ttokens=${s.tokens.length}\tmodel_bits_per_byte=${f(s.modelBpb, 9)}\t` +
    `ignorance_bits_per_byte=${f(s.ignoranceBpb, 9)}\tlongest_match_bytes=${s.longest}\t` +
    `coverage_ge32=${f(s.coverage, 9)}\tear=${s.earOk ? 'PASS' : 'FAIL'}\tanti_copy=${s.copyOk ? 'PASS' : 'FAIL'}\t` +
    `support=PASS\tstream=${s.pass ? 'PASS' : 'FAIL'}\n`;
}

function verdictOf(sittings) {
  const allEar = sittings.every(s => s.earOk), allCopy = sittings.every(s => s.copyOk);
  if (allEar && allCopy) return PASS_LINE;
  if (!allEar && !allCopy) return 'SPEECH FAIL: ignorance and frozen anti-copy gates failed';
  if (!allEar) return 'SPEECH FAIL: one or more streams did not beat honest ignorance';
  return 'SPEECH FAIL: one or more streams reached frozen anti-copy coverage 0.50';
}

/* Court report in netta.py's exact byte format. */
function report(tape, worldLen, args, sittings, verdict) {
  const enc = new TextEncoder(), parts = [];
  parts.push(enc.encode('NETTA BODY 1 — INDEPENDENT EAR\n'));
  parts.push(enc.encode(`world_bytes=${worldLen}\tlived_units=${tape.stream.length}\tmerges=${tape.exp.length - BASE_UNITS}\t` +
    `inventory=${tape.exp.length}\talive=${tape.alive.length}\torder=${args.order}\tcitizens_mode=none\tcorridor=${args.corridor}\n`));
  for (const s of sittings) {
    parts.push(enc.encode(`\nBEGIN RAW SPEECH seed=${s.seed} bytes=${s.speech.length}\n`));
    parts.push(s.speech);
    if (s.speech[s.speech.length - 1] !== 10) parts.push(enc.encode('\n'));
    parts.push(enc.encode(`END RAW SPEECH seed=${s.seed}\n`));
    parts.push(enc.encode(line(s)));
  }
  parts.push(enc.encode(`\n${verdict}\n`));
  return concat(parts);
}

const api = { crLog, Refusal, Rng, growUnits, Tape, support, lawfulSupport, speak, ear, census, sitting, line, verdictOf, report, latin1, DEFAULTS, BASE_UNITS, PASS_LINE };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Netta = api;
})(typeof self !== 'undefined' ? self : this);
