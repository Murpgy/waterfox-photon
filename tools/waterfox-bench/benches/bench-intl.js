/* bench-intl: Intl formatter re-creation cost (item 1).
 * ORIGINAL: new formatter per format call (current uncached path when options present).
 * REPLACEMENT (BENCH_MODE=cached): memoize one formatter per (locale, options).
 * Metric: RESULT_MS total for N formats. Lower is better.
 * Engine-agnostic: runs under node today, js shell later.
 */
"use strict";
if (typeof print === "undefined" && typeof console !== "undefined") {
  var print = function (s) { console.log(s); };
}
var MODE = "original";
var __cliArgs = [];
try {
  if (typeof arguments !== "undefined" && arguments) __cliArgs = Array.from(arguments);
} catch (e) {}
if (typeof process !== "undefined" && process.argv) __cliArgs = __cliArgs.concat(process.argv.slice(2));
for (var ai = 0; ai < __cliArgs.length; ai++) {
  if (String(__cliArgs[ai]).indexOf("--mode=") === 0) MODE = String(__cliArgs[ai]).slice(7);
}
if (typeof process !== "undefined" && process.env.BENCH_MODE) MODE = process.env.BENCH_MODE;

var N = 2000;
var DATES = [];
for (var i = 0; i < N; i++) DATES.push(new Date(1700000000000 + i * 86400000));

var cache = {};
function cachedFormat(locale, opts, d) {
  var k = locale + JSON.stringify(opts);
  var f = cache[k];
  if (!f) { f = new Intl.DateTimeFormat(locale, opts); cache[k] = f; }
  return f.format(d);
}
function toc(label, fn) {
  // in-JS warmup discarded (outlier control for JIT tier-up)
  fn(50);
  var t0 = Date.now();
  var acc = fn(N);
  var dt = Date.now() - t0;
  if (acc === "__impossible__") print("unreachable");
  print(label + " done");
  return dt;
}
function runOriginal(n) {
  var s = 0;
  for (var i = 0; i < n; i++) {
    var f = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" });
    s += f.format(DATES[i % N]).length;
    var g = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
    s += g.format(i * 1.2345).length;
  }
  return s;
}
function runCached(n) {
  var s = 0;
  for (var i = 0; i < n; i++) {
    s += cachedFormat("en-US", { year: "numeric", month: "short", day: "numeric" }, DATES[i % N]).length;
    var k = "de-DE" + i; // second shape to keep cache honest (2 entries)
    if (!cache[k]) cache[k] = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
    s += cache[k].format(i * 1.2345).length;
  }
  return s;
}
var ms = MODE === "cached" ? toc("cached", runCached) : toc("original", runOriginal);
print("RESULT_MS:" + ms);
