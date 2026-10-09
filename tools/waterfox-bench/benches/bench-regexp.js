/* bench-regexp: RegExp JIT tier behaviour (item 6 / JIT).
 * Warms the same patterns past the tier-up threshold, then times matching.
 * BENCH_MODE has no slow variant (engine decides tier); mode kept for symmetry.
 * Metric: RESULT_MS. Lower is better. Compare across --no-ion / native_regexp prefs in js shell.
 */
"use strict";
if (typeof print === "undefined" && typeof console !== "undefined") {
  var print = function (s) { console.log(s); };
}
var RES = [/^\w+@\w+\.\w+$/, /(\d{4})-(\d{2})-(\d{2})/, /https?:\/\/[^\s/$.?#].[^\s]*/];
var STRS = ["user@example.com", "2026-10-09T12:00:00Z", "https://www.waterfox.net/photon-classic?q=1"];
var N = 40000;
function run(n) {
  var s = 0;
  for (var i = 0; i < n; i++) {
    var r = RES[i % 3];
    var t = STRS[i % 3];
    var m = t.match(r);
    s += m ? m[0].length : 0;
  }
  return s;
}
run(2000);
var t0 = Date.now();
var acc = run(N);
var dt = Date.now() - t0;
if (acc === -1) print("unreachable");
print("RESULT_MS:" + dt);
