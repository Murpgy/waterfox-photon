/* bench-gc-nursery: allocation churn / minor-GC pressure (item 4).
 * Allocates short-lived objects steadily; measures wall time.
 * Compare across --nursery-size=16/64/128 in js shell, or nursery.max_kb prefs.
 * Outlier-sensitive by design (minor GC pauses) — needs IQR filtering.
 * Metric: RESULT_MS. Lower is better.
 */
"use strict";
if (typeof print === "undefined" && typeof console !== "undefined") {
  var print = function (s) { console.log(s); };
}
var N = 120;
var PER = 20000;
function run(n) {
  var s = 0;
  for (var r = 0; r < n; r++) {
    var arr = [];
    for (var i = 0; i < PER; i++) arr.push({ x: i, y: i * 1.5, s: "v" + (i % 100) });
    s += arr.length + arr[PER - 1].x;
    arr = null;
  }
  return s;
}
run(3);
var t0 = Date.now();
var acc = run(N);
var dt = Date.now() - t0;
if (acc === -1) print("unreachable");
print("RESULT_MS:" + dt);
