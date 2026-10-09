/* bench-dispatch: megamorphic GetProp + proto depth (item 5).
 * ORIGINAL: deep proto chain (8 levels) + polymorphic shapes.
 * REPLACEMENT (BENCH_MODE=mono): flat monomorphic objects.
 * Metric: RESULT_MS. Lower is better. Gap quantifies IC/megamorphic cliff.
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

function deepObj(depth) {
  var o = { v: 1 };
  for (var i = 0; i < depth; i++) o = Object.create(o, { w: { value: i, enumerable: true } });
  o.v = 42;
  return o;
}
var N = 200000;
function runDeep(n, objs) {
  var s = 0;
  for (var i = 0; i < n; i++) { var o = objs[i % objs.length]; s += o.v + o.w; }
  return s;
}
function runMono(n, objs) {
  var s = 0;
  for (var i = 0; i < n; i++) { var o = objs[i % objs.length]; s += o.v + o.w; }
  return s;
}
var deep = [], mono = [];
for (var k = 0; k < 50; k++) {
  deep.push(deepObj(8));
  var m = { v: k, w: k * 2 };
  if (k % 3 === 0) m.extra = k; // mild polymorphism, not pathological
  mono.push(m);
}
runDeep(2000, deep); runMono(2000, mono);
var t0 = Date.now();
var acc = MODE === "mono" ? runMono(N, mono) : runDeep(N, deep);
var dt = Date.now() - t0;
if (acc === -1) print("unreachable");
print("RESULT_MS:" + dt);
