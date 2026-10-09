/* bench-species: Array @@species fuse hygiene (item 6).
 * ORIGINAL: breaks the fuse (mutates Array[@@species]) forcing slow path.
 * REPLACEMENT (BENCH_MODE=fused): intact fuse, packed arrays.
 * Metric: RESULT_MS for map/filter chains. Lower is better.
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

var N = 600;
var src = [];
for (var i = 0; i < 2000; i++) src.push(i);
function runFused(n) {
  var s = 0;
  for (var r = 0; r < n; r++) {
    var m = src.map(function (x) { return x * 2; }).filter(function (x) { return x % 3 === 0; });
    s += m.length;
  }
  return s;
}
if (MODE !== "fused") {
  // break the species fuse once: forces generic SpeciesConstructor path
  try { Array[Symbol.species] = Array; } catch (e) {}
}
runFused(10);
var t0 = Date.now();
var acc = runFused(N);
var dt = Date.now() - t0;
if (acc === -1) print("unreachable");
print("RESULT_MS:" + dt);
