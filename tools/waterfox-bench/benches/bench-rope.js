/* bench-rope: string concat discipline (item 6).
 * ORIGINAL: += in a loop (rope + repeated flatten on use).
 * REPLACEMENT (BENCH_MODE=join): array push + single join (one alloc).
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

var N = 400;
var K = 2000;
function runPlus(n) {
  var s = 0;
  for (var r = 0; r < n; r++) {
    var acc = "";
    for (var i = 0; i < K; i++) acc += "x" + (i % 10);
    s += acc.length + acc.charCodeAt(0);
  }
  return s;
}
function runJoin(n) {
  var s = 0;
  for (var r = 0; r < n; r++) {
    var parts = [];
    for (var i = 0; i < K; i++) parts.push("x" + (i % 10));
    var acc = parts.join("");
    s += acc.length + acc.charCodeAt(0);
  }
  return s;
}
runPlus(3); runJoin(3);
var t0 = Date.now();
var acc = MODE === "join" ? runJoin(N) : runPlus(N);
var dt = Date.now() - t0;
if (acc === -1) print("unreachable");
print("RESULT_MS:" + dt);
