# netta.js — third body, parity against netta.py

Engine: `netta_engine.js` (browser + node). Step-for-step port of netta.py.
Admission test: court report (`--report`) byte-identical, and every trace_<seed>.tsv byte-identical.

## Measured (node v22 vs CPython, Linux/glibc)

| island | dials | verdict | report | traces |
|---|---|---|---|---|
| netta.txt 447545 B | defaults | PASS | identical | 5/5 identical |
| netta.txt | --merges 500 --min-pair 9 --temp 0.3 | PASS | identical | |
| netta.txt | --corridor 0 --bytes 2000 --seeds 1,2,3,1000003,99999999 | FAIL (anti-copy) | identical | |
| netta.txt | --corridor 3 --order 3 --topk 40 --temp 1.3 | FAIL (anti-copy) | identical | |
| netta.txt | --merges 64 --min-pair 2 --temp 0.2 --topk 3 | PASS | identical | |
| netta.txt | --merges 2000 --temp 0.5 --bytes 5000, 8 seeds | PASS | identical | |
| tinyshakespeare 1115394 B | defaults | PASS | identical | |
| tinyshakespeare | --temp 0.4 --seeds 3,5,8,13,21 | PASS | identical | |
| netta.code corpora (mixed, art) | defaults | both refuse: "no sentence starts" | — | — |

## Finding: the mouth's ranking depends on the last bit of libm

`speak()` sorts candidates by `log(cnt) - log(1 + 0.5*rep)`. Mathematically equal
scores occur: cnt=3,rep=1 gives ln3 − ln1.5 = ln2 = cnt=2,rep=0. Which one ranks
higher is decided by the last bit of `log`. glibc: log(3)=1.0986122886681098 →
the rep-damped token wins. V8 Math.log(3)=1.0986122886681096 (1 ulp off) → it
loses, the top-k cut shifts, the speech diverges (first seen: netta.txt,
--merges 500 --min-pair 9 --temp 0.3, seed 7, step 15).

Fix in this body: `crLog`, double-double, correctly rounded. Checked on 300025
arguments (integers 1..300000 and every 1+0.5k): Math.log disagrees with glibc
2433 times, crLog 6 times — and in all 6 glibc is the one off (hard near-halfway
cases, counts ≥ 9170).

Consequence for the C and python bodies, not only this one: parity across
platforms is a claim about libm, not about the organism. Any libm that is not
correctly rounded on these arguments (macOS, musl, MSVC — unmeasured) can speak
differently from the same seed. Candidate amendment: break mathematically-equal
scores exactly (compare cnt·(1+0.5·rep') vs cnt'·(1+0.5·rep) as rationals) and
use log only for weights. That makes the ranking platform-free.

## Not yet equal by construction (measured equal here, not proven)
- `Math.exp` in weights and `Math.log2` in the ear are V8's. They can differ from
  glibc by an ulp. Effect: sampling only if r lands within ~1 ulp of a boundary;
  the ear only in the 9th printed digit. Not observed in the runs above.
