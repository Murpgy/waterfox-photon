/* bench-mapset: Map/Set hashing behaviour (item 6).
 * ORIGINAL: delete-heavy churn (triggers in-place rehash).
 * REPLACEMENT (BENCH_MODE=steady): pre-sized steady use, no deletes.
 * Metric: RESULT_MS. Lower is better.
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

var N = 300;
function runChurn(n) {
  var s = 0;
  for (var r = 0; r < n; r++) {
    var m = new Map();
    for (var i = 0; i < 2000; i++) m.set("k" + i, i);
    for (var d = 0; d < 1000; d++) m.delete("k" + d);
    for (var j = 1000; j < 2000; j++) s += m.get("k" + j);
  }
  return s;
}
function runSteady(n) {
  var s = 0;
  var m = new Map();
  for (var i = 0; i < 2000; i++) m.set("k" + i, i);
  for (var r = 0; r < n; r++) {
    for (var j = 0; j < 2000; j++) s += m.get("k" + j);
  }
  return s;
}
runChurn(2); runSteady(2);
var t0 = Date.now();
var acc = MODE === "steady" ? runSteady(N) : runChurn(N);
var dt = Date.now() - t0;
if (acc === -1) print("unreachable");
print("RESULT_MS:" + dt);
