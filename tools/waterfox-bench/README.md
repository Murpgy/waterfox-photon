# Waterfox local benchmarks — items 1-7 (original vs replacement)

Engine-agnostic JS microbenchmarks + a Python harness with Talos-style
statistics. Runs on `node` today; runs on the built `js` shell unmodified
(`runner.py` auto-detects `obj-*/dist/bin/js` with `--engine auto`).

## Matrix

| # | Item | Bench file(s) | Modes (BENCH_MODE / --mode=) | Metric | Compares |
|---|---|---|---|---|---|
| 1 | Intl memoization | bench-intl.js | original (new each call) vs cached | ms, RSS | call-site fix value |
| 2 | PGO | whole suite | binary A vs binary B (`--engine path`) | ms / score | build-level, needs two builds |
| 3 | Pref defaults | bench-regexp.js, bench-dispatch.js | js flags (`--no-ion`, `--nursery-size`) | ms | do-no-harm guard |
| 4 | Nursery sizing | bench-gc-nursery.js | `--nursery-size=16/64/128` (js shell) | ms + RSS, IQR-filtered | minor-GC cadence |
| 5 | Interpreter dispatch | bench-dispatch.js | original (deep/poly) vs mono | ms | IC cliff size |
| 6a | JSON fast-path | bench-json.js | original (replacer+space) vs fast | ms | slow-path cost |
| 6b | Rope discipline | bench-rope.js | original (+=) vs join | ms + RSS | flatten cliff |
| 6c | Species fuse | bench-species.js | original (broken) vs fused | ms | fuse value |
| 6d | Map/Set | bench-mapset.js | original (churn) vs steady | ms | rehash cost |
| 6e | RegExp JIT | bench-regexp.js | tier-up timing (engine decides) | ms | JIT-on guard |
| 7 | MOZ_COLD | binary-level (not JS): `size`, startup wall | with/without patch | bytes, ms | code locality |

## Outlier policy

- In-JS warmup iteration discarded per file (JIT tier-up).
- Process-level: first of N runs discarded (`--warmup 1`, Talos `ignore_first`).
- Report: median (primary), IQR-filtered median, p95, min/max, mean±stdev.
- `compare` flags a win only if medians AND p95 agree on direction and
  |delta| exceeds 2x pooled noise; outliers listed explicitly.

## Commands

```bash
# all benches, node, 7 runs
python3 tools/waterfox-bench/runner.py run --engine node --runs 7 --out /tmp/base.json

# single bench, replacement mode
BENCH_MODE=cached python3 tools/waterfox-bench/runner.py run --engine node --runs 7 --out /tmp/intl-cached.json bench-intl

# compare
python3 tools/waterfox-bench/runner.py compare --a /tmp/base.json --b /tmp/intl-cached.json

# js shell once built (auto-detect + nursery sweep example)
python3 tools/waterfox-bench/runner.py run --engine auto --runs 11 --out /tmp/js.json bench-gc-nursery
obj-*/dist/bin/js --nursery-size=16 tools/waterfox-bench/benches/bench-gc-nursery.js
```

## Interpreting before implementing (rule)

No item 1-7 lands unless: replacement beats original on filtered median
AND p95, with no RSS regression, across two consecutive runs. Single-run
wins with IQR outliers present are treated as noise.
