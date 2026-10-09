#!/usr/bin/env python3
"""Waterfox local benchmark harness: original vs replacement.

Runs each bench JS under node (today) or a built `js` shell
(obj-*/dist/bin/js, once built), collects wall-time replicates plus
max-RSS, and reports median / p95 / IQR-outlier-filtered stats with a
Talos-style warmup discard.

Usage:
  python3 runner.py run [--engine node|/path/to/js] [--runs 7] [--warmup 1] [bench ...]
  python3 runner.py compare --a results-a.json --b results-b.json
  python3 runner.py sweep --engine /path/to/js   # nursery / jitflag matrix (js shell only)

Results JSON schema:
  {"bench": {"samples_ms": [...], "rss_kb": [...], "stats": {...}}}

Outlier policy (mirrors testing/talos/talos/filter.py + raptor median):
  - discard first `warmup` process replicates (default 1)
  - in-JS warmup iteration discarded inside each bench file
  - primary signal: median; reported alongside p95, min, max, mean, stddev
  - IQR fence (1.5x) flags outliers; comparison uses both raw median
    and IQR-filtered median so a single GC pause cannot fake a win
"""

import argparse
import json
import os
import statistics
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BENCH_DIR = os.path.join(HERE, "benches")

ALL_BENCHES = sorted(
    f[:-3] for f in os.listdir(BENCH_DIR) if f.endswith(".js")
)


def find_js_shell():
    import glob

    candidates = sorted(glob.glob("obj-*/dist/bin/js"))
    return candidates[0] if candidates else None


def run_once(engine, bench_path, extra_args):
    """Run one bench file once. Returns (elapsed_ms, rss_kb)."""
    js_args = os.environ.get("JS_ARGS", "").split()
    cmd = [engine] + js_args + [bench_path] + extra_args
    # /usr/bin/time -v gives max RSS portably on Linux; fall back to plain run.
    time_bin = "/usr/bin/time"
    use_time = os.path.exists(time_bin + "") or os.path.exists("/usr/bin/time")
    if use_time and os.path.exists("/usr/bin/time"):
        cmd = ["/usr/bin/time", "-v"] + cmd
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if proc.returncode != 0:
        raise RuntimeError(
            f"{bench_path} failed (rc={proc.returncode}):\n{proc.stderr[-2000:]}"
        )
    elapsed_ms = None
    for line in proc.stdout.splitlines():
        if line.startswith("RESULT_MS:"):
            elapsed_ms = float(line.split(":", 1)[1].strip())
    if elapsed_ms is None:
        raise RuntimeError(f"{bench_path} printed no RESULT_MS:\n{proc.stdout[-2000:]}")
    rss_kb = None
    for line in proc.stderr.splitlines():
        if "Maximum resident set size" in line:
            rss_kb = int(line.split(":")[1].strip().split()[0])
    return elapsed_ms, rss_kb


def summarize(samples, warmup=1):
    kept = samples[warmup:] if len(samples) > warmup else samples[:]
    if not kept:
        raise ValueError("no samples after warmup discard")
    ordered = sorted(kept)
    n = len(ordered)
    med = statistics.median(ordered)
    mean = statistics.mean(ordered)
    stdev = statistics.stdev(ordered) if n > 1 else 0.0
    p95 = ordered[min(n - 1, int(n * 0.95))]
    if n >= 4:
        qs = statistics.quantiles(ordered, n=4)
        q1, q3 = qs[0], qs[2]
        iqr = q3 - q1
        lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        filtered = [x for x in ordered if lo <= x <= hi]
        outliers = [x for x in ordered if x < lo or x > hi]
    else:
        filtered, outliers = ordered, []
    fmed = statistics.median(filtered) if filtered else med
    return {
        "n": n,
        "median_ms": med,
        "filtered_median_ms": fmed,
        "mean_ms": mean,
        "stdev_ms": stdev,
        "p95_ms": p95,
        "min_ms": ordered[0],
        "max_ms": ordered[-1],
        "outliers": outliers,
        "replicates": samples,
    }


def cmd_run(args):
    engine = args.engine
    if engine == "auto":
        engine = find_js_shell() or "node"
    benches = args.benches or ALL_BENCHES
    out = {}
    print(f"engine={engine} runs={args.runs} warmup={args.warmup}")
    for bench in benches:
        path = os.path.join(BENCH_DIR, bench + ".js")
        mode = os.environ.get("BENCH_MODE", "")
        extra = ["--mode=" + mode] if mode else []
        samples, rss = [], []
        for i in range(args.runs):
            ms, kb = run_once(engine, path, extra)
            samples.append(ms)
            if kb is not None:
                rss.append(kb)
            print(f"  {bench} run {i + 1}/{args.runs}: {ms:.2f} ms")
        stats = summarize(samples, warmup=args.warmup)
        if rss:
            stats["rss_median_kb"] = statistics.median(rss)
            stats["rss_max_kb"] = max(rss)
        out[bench] = stats
        print(
            f"{bench}: median={stats['median_ms']:.2f} "
            f"filt={stats['filtered_median_ms']:.2f} "
            f"p95={stats['p95_ms']:.2f} "
            f"outliers={stats['outliers']}"
        )
    with open(args.out, "w") as f:
        json.dump(out, f, indent=2)
    print(f"wrote {args.out}")


def cmd_compare(args):
    a = json.load(open(args.a))
    b = json.load(open(args.b))
    print(f"A={args.a} B={args.b} (negative % = B faster)")
    print(f"{'bench':22} {'A_med':>10} {'B_med':>10} {'delta%':>8} {'A_p95':>10} {'B_p95':>10}")
    for bench in sorted(set(a) | set(b)):
        if bench not in a or bench not in b:
            print(f"{bench:22} MISSING in one side")
            continue
        am, bm = a[bench]["filtered_median_ms"], b[bench]["filtered_median_ms"]
        ap, bp = a[bench]["p95_ms"], b[bench]["p95_ms"]
        delta = (bm - am) / am * 100 if am else 0.0
        flag = ""
        # Significance heuristic: win only if medians AND p95 agree on direction
        # and |delta| exceeds pooled noise (mean stdev / median).
        noise = (a[bench]["stdev_ms"] + b[bench]["stdev_ms"]) / 2 / am * 100 if am else 0
        if abs(delta) > max(2.0, 2 * noise) and (bp - ap) * delta > 0:
            flag = "  <-- significant"
        elif a[bench]["outliers"] or b[bench]["outliers"]:
            flag = "  (outliers present, treat with suspicion)"
        print(f"{bench:22} {am:10.2f} {bm:10.2f} {delta:+7.2f}% {ap:10.2f} {bp:10.2f}{flag}")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--engine", default="auto", help="node | auto | /path/to/js")
    r.add_argument("--runs", type=int, default=7)
    r.add_argument("--warmup", type=int, default=1)
    r.add_argument("--out", default="results.json")
    r.add_argument("benches", nargs="*")
    c = sub.add_parser("compare")
    c.add_argument("--a", required=True)
    c.add_argument("--b", required=True)
    args = ap.parse_args()
    if args.cmd == "run":
        cmd_run(args)
    else:
        cmd_compare(args)


if __name__ == "__main__":
    main()
