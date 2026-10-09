/* bench-json: JSON fast-path discipline (item 6).
 * ORIGINAL: stringify with replacer+space and toJSON present (forces slow path).
 * REPLACEMENT (BENCH_MODE=fast): plain packed data, no replacer/space/toJSON.
 * Metric: RESULT_MS for N stringify+parse round trips. Lower is better.
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

var N = 1500;
var base = [];
for (var i = 0; i < 200; i++) base.push({ id: i, name: "item-" + i, v: i * 1.5, tags: ["a", "b"] });

function runSlow(n) {
  var s = 0;
  var replacer = function (k, v) { return v; };
  for (var i = 0; i < n; i++) {
    var t = JSON.stringify(base, replacer, 2);
    s += t.length;
    s += JSON.parse(t).length;
  }
  return s;
}
function runFast(n) {
  var s = 0;
  for (var i = 0; i < n; i++) {
    var t = JSON.stringify(base);
    s += t.length;
    s += JSON.parse(t).length;
  }
  return s;
}
runSlow(20); runFast(20); // warmup
var t0 = Date.now();
var acc = MODE === "fast" ? runFast(N) : runSlow(N);
var dt = Date.now() - t0;
if (acc === -1) print("unreachable");
print("RESULT_MS:" + dt);
