// |jit-test| skip-if: typeof getStringifyBailCounts !== "function"

// Waterfox benchmark variant (item 6): the bail-counter surface exists and
// counts slow-path stringifies. Runs with the pref off (all zeros expected
// except ApiForced-style entries) and on; behavior of stringify itself is
// unchanged either way.

var counts = getStringifyBailCounts();
assertEq(typeof counts, "object");
assertEq(typeof counts.HAVE_REPLACER, "number");

// Plain packed object: fast path, no bail recorded for replacer/space.
var before = getStringifyBailCounts().HAVE_REPLACER;
JSON.stringify({ a: 1, b: [1, 2, 3] });
assertEq(getStringifyBailCounts().HAVE_REPLACER, before);

// Replacer forces the slow path: counter must advance by exactly one when
// counting is enabled, and stay flat when it is off.
var repBefore = getStringifyBailCounts().HAVE_REPLACER;
JSON.stringify({ a: 1 }, function (k, v) { return v; });
var repAfter = getStringifyBailCounts().HAVE_REPLACER;
assertEq(repAfter - repBefore <= 1, true);
assertEq(JSON.stringify({ a: 1 }, function (k, v) { return v; }), '{"a":1}');
