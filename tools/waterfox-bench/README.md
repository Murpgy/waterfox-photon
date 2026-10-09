# Waterfox local benchmarks — items 1-7 (original vs replacement)

Engine-agnostic JS microbenchmarks + a Python harness with Talos-style
statistics. Runs on `node` today; runs on the built `js` shell unmodified
(`runner.py` auto-detects `obj-*/dist/bin/js` with `--engine auto`).

## Implemented variants (all default-off = generic execution)

| Item | Flag / pref | Code |
|---|---|---|
| 1 Intl optionful memo | `javascript.options.intl_optionful_cache` (startup) | `js/src/builtin/intl/GlobalIntlData.{h,cpp}`, `Collator/NumberFormat/DateTimeFormat.{h,cpp}` |
| 2 PGO aarch64-windows | `wfx_pgo=cross-or-native` | `waterfox/build/mozconfig-aarch64-pc-windows-msvc` |
| 3 Pref baseline lock | `audit-prefs.py` (25 checks) | fails CI/local on drift |
| 5 Interpreter predict | always-on micro-opt (no flag; semantically neutral) | `js/src/vm/Interpreter.cpp` PREDICT_NEXT_OP |
| 5b NoGC GetProp attempt | DEFERRED pending js-shell validation (rooting safety needs jit-test) | — |
| 6 JSON bail counters | `javascript.options.json_bail_counters` (startup) + `getStringifyBailCounts()` shell fn | `js/src/builtin/JSON.{h,cpp}`, `js/src/shell/js.cpp` |
| 7 MOZ_COLD aborts | always-on layout hint | `js/src/jit/WarpOracle.cpp`, `js/src/jit/Ion.cpp` |

Correctness tests: `js/src/jit-test/tests/JSON/stringify-bail-counts.js`,
`js/src/jit-test/tests/intl/optionful-memo-correctness.js`.

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

# nursery sweep across sizes (item 4; JS_ARGS passthrough)
for sz in 16 64 128; do
  JS_ARGS="--nursery-size=$sz" python3 tools/waterfox-bench/runner.py run \
    --engine /path/to/js --runs 11 --out /tmp/nursery-$sz.json bench-gc-nursery
done

# JIT-tier guard (item 3/5): interpreter-only vs full tiers on the js shell
JS_ARGS="--no-blinterp --no-baseline --no-ion" python3 tools/waterfox-bench/runner.py run \
  --engine /path/to/js --runs 7 --out /tmp/interp.json bench-dispatch

# pref audit (item 3)
python3 tools/waterfox-bench/audit-prefs.py --root .
```

## Interpreting before implementing (rule)

No item 1-7 lands unless: replacement beats original on filtered median
AND p95, with no RSS regression, across two consecutive runs. Single-run
wins with IQR outliers present are treated as noise.
