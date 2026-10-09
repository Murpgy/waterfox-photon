#!/usr/bin/env python3
"""Audit Waterfox JS safe-baseline prefs (benchmark item 3).

Fails if any known-good JIT/GC/WASM default drifts from the values our
benchmark conclusions assume. Run locally and in CI before interpreting
any original-vs-replacement comparison.

Usage: python3 audit-prefs.py [--root /path/to/tree]
"""

import argparse
import re
import sys

# (file, pref-name, expected-value, kind)
# kind "yaml-bool"/"yaml-int" reads StaticPrefList.yaml `value:` lines;
# kind "js" reads modules/libpref/init/all.js pref(...) lines.
CHECKS = [
    # JIT tiers on (item 3 / JIT audit)
    ("modules/libpref/init/StaticPrefList.yaml", "javascript.options.blinterp", True, "yaml"),
    ("modules/libpref/init/StaticPrefList.yaml", "javascript.options.baselinejit", True, "yaml"),
    ("modules/libpref/init/StaticPrefList.yaml", "javascript.options.ion", True, "yaml"),
    ("modules/libpref/init/StaticPrefList.yaml", "javascript.options.native_regexp", True, "yaml"),
    ("modules/libpref/init/StaticPrefList.yaml", "javascript.options.jithints", True, "yaml"),
    ("modules/libpref/init/StaticPrefList.yaml", "javascript.options.blinterp.threshold", 10, "yaml"),
    ("modules/libpref/init/StaticPrefList.yaml", "javascript.options.baselinejit.threshold", 100, "yaml"),
    ("modules/libpref/init/StaticPrefList.yaml", "javascript.options.ion.threshold", 1500, "yaml"),
    ("modules/libpref/init/StaticPrefList.yaml", "javascript.options.ion.offthread_compilation", True, "yaml"),
    ("modules/libpref/init/StaticPrefList.yaml", "javascript.options.objectfuse_for_global", True, "yaml"),
    ("modules/libpref/init/StaticPrefList.yaml", "javascript.options.objectfuse_for_js_builtin_ctors_protos", True, "yaml"),
    ("modules/libpref/init/StaticPrefList.yaml", "javascript.options.objectfuse_for_all_protos", True, "yaml"),
    # GC safe baseline (item 3 / GC audit)
    ("modules/libpref/init/all.js", "javascript.options.mem.gc_per_zone", True, "js"),
    ("modules/libpref/init/all.js", "javascript.options.mem.gc_incremental", True, "js"),
    ("modules/libpref/init/all.js", "javascript.options.mem.gc_compacting", True, "js"),
    ("modules/libpref/init/all.js", "javascript.options.mem.gc_generational", True, "js"),
    ("modules/libpref/init/all.js", "javascript.options.mem.gc_incremental_slice_ms", 5, "js"),
    ("modules/libpref/init/all.js", "javascript.options.mem.nursery.min_kb", 256, "js"),
    ("modules/libpref/init/all.js", "javascript.options.mem.nursery.max_kb", 65536, "js"),
    ("modules/libpref/init/all.js", "javascript.options.mem.gc_max_parallel_marking_threads", 2, "js"),
    # WASM tiers on (item 6)
    ("modules/libpref/init/StaticPrefList.yaml", "javascript.options.wasm_caching", True, "yaml"),
    ("modules/libpref/init/StaticPrefList.yaml", "javascript.options.wasm_optimizingjit", True, "yaml"),
    ("modules/libpref/init/StaticPrefList.yaml", "javascript.options.wasm_lazy_tiering", True, "yaml"),
    # Benchmark variants default OFF = generic execution
    ("modules/libpref/init/StaticPrefList.yaml", "javascript.options.intl_optionful_cache", False, "yaml"),
    ("modules/libpref/init/StaticPrefList.yaml", "javascript.options.json_bail_counters", False, "yaml"),
]

YAML_RE = re.compile(r"^-\s*name:\s*(\S+)\s*\n\s*type:\s*\S+\s*\n\s*value:\s*(\S+)", re.M)
JS_RE = re.compile(r'pref\("([^"]+)",\s*([^)]+)\);')


def parse_value(text):
    text = text.strip().rstrip(",")
    if text in ("true", "True"):
        return True
    if text in ("false", "False"):
        return False
    try:
        return int(text)
    except ValueError:
        pass
    try:
        return float(text)
    except ValueError:
        pass
    return text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    args = ap.parse_args()
    failures = []
    for rel, name, expected, kind in CHECKS:
        path = f"{args.root}/{rel}"
        try:
            with open(path) as f:
                content = f.read()
        except OSError as e:
            failures.append(f"{name}: cannot read {rel}: {e}")
            continue
        found = None
        if kind == "yaml":
            for m in YAML_RE.finditer(content):
                if m.group(1) == name:
                    found = parse_value(m.group(2))
                    break
        else:
            for m in JS_RE.finditer(content):
                if m.group(1) == name:
                    found = parse_value(m.group(2))
                    break
        if found is None:
            failures.append(f"{name}: not found in {rel} (renamed?)")
        elif found != expected:
            failures.append(f"{name}: got {found!r}, expected {expected!r}")
    if failures:
        print(f"{len(failures)} pref-baseline violation(s):")
        for f in failures:
            print(f"  FAIL: {f}")
        return 1
    print(f"pref baseline OK ({len(CHECKS)} checks)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
