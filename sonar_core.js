/* NETTA.SONAR — the listening layer.
   Canonical: speak / court go through the engine untouched (byte-identical to netta.py).
   Sonar's own, named:
     S1  echo. The listener's words are tokenized by her merge law and become the
         context. Every token after them must be lawful lived support (same
         corridor law), and is priced by the same ear from that context. The
         listener's words themselves are not priced. Echoes are NOT sittings of
         SPEECH_COURT; their numbers are shown for what they are.
     S2  hearing. With "keep" on, the listener's words are folded into a heard
         layer beside the lived tape (never into it). Echoes walk tape + heard;
         canonical sittings walk the tape alone. Her own echoes are never heard
         back — no self-feeding.
     S3  ranking in the echo mouth compares 2·cnt_a·(2+rep_b) against
         2·cnt_b·(2+rep_a) as integers (ln is monotone), so the order is
         platform-free; ln stays only in the sampling weights. */
function sonarCore(N, post) {
  'use strict';
  const P = 65536, REP_WINDOW = 12, SPEAK_HARD = 256;
  let world = null, worldStr = '', tape = null, exp = null, rank = null, args = null;
  let heard = null, heardStr = '', heardCount = 0;
  const enc = new TextEncoder();

  const newHeard = () => ({ uni: new Map(), bi: new Map(), tri: new Map(), quad: new Map() });
  const bump = (m, p, t) => { let x = m.get(p); if (!x) m.set(p, x = new Map()); x.set(t, (x.get(t) || 0) + 1); };

  function tokenize(bytes) {
    let t = Array.from(bytes);
    for (;;) {
      let best = -1;
      for (let i = 0; i + 1 < t.length; i++) { const r = rank.get(t[i] * P + t[i + 1]); if (r !== undefined && (best < 0 || r < best)) best = r; }
      if (best < 0) return t;
      const out = [];
      for (let i = 0; i < t.length; i++) {
        if (i + 1 < t.length && rank.get(t[i] * P + t[i + 1]) === best) { out.push(best); i++; } else out.push(t[i]);
      }
      t = out;
    }
  }

  function absorb(toks) {
    for (let i = 0; i < toks.length; i++) {
      heard.uni.set(toks[i], (heard.uni.get(toks[i]) || 0) + 1);
      if (i >= 1) bump(heard.bi, toks[i - 1], toks[i]);
      if (i >= 2) bump(heard.tri, toks[i - 2] * P + toks[i - 1], toks[i]);
      if (i >= 3 && args.order >= 4) bump(heard.quad, (toks[i - 3] * P + toks[i - 2]) * P + toks[i - 1], toks[i]);
    }
  }

  function heardAt(em, level) {
    const n = em.length;
    if (level === 4) return args.order >= 4 && n >= 3 ? heard.quad.get((em[n - 3] * P + em[n - 2]) * P + em[n - 1]) : null;
    if (level === 3) return n >= 2 ? heard.tri.get(em[n - 2] * P + em[n - 1]) : null;
    if (level === 2) return n >= 1 ? heard.bi.get(em[n - 1]) : null;
    return heard.uni;
  }

  /* lived tape + heard layer, ascending unit id; heard share returned beside it */
  function sSupport(em, level) {
    const base = N.support(tape, em, level, args.order), h = heardAt(em, level);
    if (!h || !h.size) return base;
    const m = new Map(base);
    for (const [t, c] of h) m.set(t, (m.get(t) || 0) + c);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }

  function sLawful(em, corr) {
    const K = args.corridor;
    let cand = [], level = 0;
    for (const l of [4, 3, 2, 1]) { cand = sSupport(em, l); if (cand.length) { level = l; break; } }
    if (!cand.length) throw new N.Refusal('empty lived support');
    if (cand.length >= 2) return [cand, level, null, 0];
    if (K && corr >= K) {
      const rail = cand[0][0];
      for (let l = level - 1; l > 0; l--) {
        const alt = sSupport(em, l);
        if (alt.length >= 2) return [alt.filter(c => c[0] !== rail), l, rail, 0];
      }
    }
    return [cand, level, null, K ? corr + 1 : corr];
  }

  let tapeUniMap = null;
  const tapeHas = t => tapeUniMap.has(t);

  function stepOut(s) {
    return { index: s.index, tok: s.tok, level: s.level, n: s.cand ? s.cand.length : 0, occ: s.occ || 0,
      chosen: s.chosen || 0, veto: s.veto == null ? null : s.veto, ranked: s.ranked || [], probs: s.probs || [], opening: !!s.opening };
  }

  function echo(text, seed, want0) {
    const bytes = enc.encode(text);
    const toks = tokenize(bytes);
    const ping = toks.map(t => ({ tok: t, lived: tapeHas(t), heard: heard.uni.has(t) }));
    const em = toks.slice(-3);
    const ctxLen = em.length;
    const rng = new N.Rng(BigInt(seed) ^ 0x9E3779B97F4A7C15n);
    const steps = [], parts = []; let outLen = 0, corr = 0, want = want0; const hard = want0 + SPEAK_HARD;
    while (outLen < want && em.length < 60000) {
      const before = corr;
      let cand, level, veto; [cand, level, veto, corr] = sLawful(em, corr);
      const win = em.slice(-REP_WINDOW);
      let occ = 0; const sc = [];
      for (const [tok, cnt] of cand) {
        occ += cnt; let rep = 0; for (const w of win) if (w === tok) rep++;
        sc.push([tok, cnt, rep, N.crLog(cnt) - N.crLog(1 + 0.5 * rep)]);
      }
      sc.sort((a, b) => { const l = a[1] * (2 + b[2]), r = b[1] * (2 + a[2]); return l !== r ? r - l : a[0] - b[0]; });
      const limit = Math.min(sc.length, args.topk), w = []; let top = -1e300;
      for (let i = 0; i < limit; i++) { const v = sc[i][3] / args.temp; w.push(v); if (v > top) top = v; }
      let total = 0; for (let i = 0; i < limit; i++) { w[i] = Math.exp(w[i] - top); total += w[i]; }
      const r = rng.double() * total; let cum = 0, at = 0;
      for (let i = 0; i < limit; i++) { cum += w[i]; if (cum > r) { at = i; break; } }
      const [tok, cnt] = sc[at], e = exp[tok];
      em.push(tok); parts.push(e); outLen += e.length;
      steps.push(stepOut({ index: em.length - 1, tok, level, cand, occ, chosen: cnt, veto, corridor: before,
        ranked: sc.slice(0, limit).map(x => x[0]), probs: w.map(x => x / total) }));
      /* her units cross sentence borders; a unit holding an end closes the echo */
      let ends = false; for (const c of e) if (c === 46 || c === 33 || c === 63 || c === 10) { ends = true; break; }
      if (outLen >= want && !ends && outLen < hard) want = outLen + 1;
    }
    const reply = em.slice(ctxLen);
    /* the ear, re-derived from the tokens alone */
    const past = em.slice(0, ctxLen); let model = 0, c2 = 0;
    for (const tok of reply) {
      let cand; [cand, , , c2] = sLawful(past, c2);
      let occ = 0, ch = 0; for (const [t, c] of cand) { occ += c; if (t === tok) ch = c; }
      if (!ch) throw new N.Refusal('echo token outside lawful lived support');
      model += -Math.log2(ch / occ); past.push(tok);
    }
    let alive = tape.alive.length; for (const t of heard.uni.keys()) if (!tapeHas(t)) alive++;
    const speech = new Uint8Array(outLen); { let k = 0; for (const p of parts) { speech.set(p, k); k += p.length; } }
    const cen = N.census(speech, heardStr ? worldStr + '\n' + heardStr : worldStr);
    const res = { ping, steps, depth: steps.length ? steps[0].level : 0, bytes: speech.length,
      modelBpb: model / Math.max(1, speech.length), ignoranceBpb: reply.length * Math.log2(alive) / Math.max(1, speech.length),
      longest: cen.longest, coverage: cen.coverage, alive };
    return { res, toks, bytes };
  }

  function keep(text, toks, bytes) {
    absorb(toks); heardCount++;
    heardStr += (heardStr ? '\n' : '') + N.latin1(bytes);
  }

  const handlers = {
    grow(m) {
      world = m.world; args = { ...N.DEFAULTS, ...(m.args || {}) };
      const merges = []; let batch = [];
      const t0 = Date.now();
      const r = N.growUnits(world, args.merges, args.min_pair, (id, a, b, cnt) => {
        merges.push(id, a, b, cnt); batch.push(id, a, b, cnt);
        if (batch.length >= 256) { post({ ev: 'merges', batch }); batch = []; }
      });
      if (batch.length) post({ ev: 'merges', batch });
      const tGrow = Date.now() - t0;
      rank = new Map(); for (let i = 0; i < merges.length; i += 4) rank.set(merges[i + 1] * P + merges[i + 2], merges[i]);
      exp = r.exp;
      tape = new N.Tape(r.stream, r.exp, args.order, true);
      tapeUniMap = new Map(tape.uni);
      worldStr = N.latin1(world);
      heard = newHeard(); heardStr = ''; heardCount = 0;
      post({ ev: 'grown', worldLen: world.length, streamLen: r.stream.length, exp: r.exp, uni: tape.uni,
        canSpeak: tape.starts.length > 0, msGrow: tGrow, msTotal: Date.now() - t0, args });
    },
    remember(m) {
      for (const text of m.texts) { const bytes = enc.encode(text); keep(text, tokenize(bytes), bytes); }
      post({ ev: 'remembered', heardCount });
    },
    speak(m) {
      const steps = [];
      const s = N.sitting(tape, worldStr, m.seed, args, st => steps.push(stepOut(st)));
      post({ ev: 'spoken', id: m.id, steps, sitting: pack(s) });
    },
    court(m) {
      const sits = args.seeds.map(seed => N.sitting(tape, worldStr, seed, args));
      const verdict = N.verdictOf(sits);
      const report = N.report(tape, world.length, args, sits, verdict);
      post({ ev: 'court', id: m.id, sittings: sits.map(pack), verdict, report });
    },
    echo(m) {
      const { res, toks, bytes } = echo(m.text, m.seed, m.want || 110);
      if (m.keep) keep(m.text, toks, bytes);
      res.heardCount = heardCount; res.kept = !!m.keep;
      post({ ev: 'echoed', id: m.id, res });
    },
    forget() { heard = newHeard(); heardStr = ''; heardCount = 0; post({ ev: 'remembered', heardCount }); }
  };
  function pack(s) {
    return { seed: s.seed, speechLen: s.speech.length, tokens: s.tokens.length, modelBpb: s.modelBpb, ignoranceBpb: s.ignoranceBpb,
      longest: s.longest, coverage: s.coverage, earOk: s.earOk, copyOk: s.copyOk, pass: s.pass, line: N.line(s) };
  }
  return function handle(m) {
    try { handlers[m.cmd](m); }
    catch (err) { post({ ev: 'error', id: m.id, cmd: m.cmd, msg: String(err && err.message || err) }); }
  };
}
if (typeof module !== 'undefined' && module.exports) module.exports = sonarCore;
