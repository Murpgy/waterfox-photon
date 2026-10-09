// |jit-test|

// Waterfox benchmark variant (item 1): frozen-options construction must
// produce correct formatters whether or not the optionful memo pref is on.
// Behavioral test only; the speedup is measured by tools/waterfox-bench.

var frozenOpts = Object.freeze({ year: "numeric", month: "short", day: "numeric" });
var d = new Date(Date.UTC(2026, 9, 9, 12, 0, 0));

var f1 = new Intl.DateTimeFormat("en-US", frozenOpts);
var f2 = new Intl.DateTimeFormat("en-US", frozenOpts);
assertEq(f1.format(d), f2.format(d));

var nf1 = new Intl.NumberFormat("de-DE", Object.freeze({ style: "currency", currency: "EUR" }));
var nf2 = new Intl.NumberFormat("de-DE", Object.freeze({ style: "currency", currency: "EUR" }));
assertEq(typeof nf1.format(1234.5), "string");
assertEq(nf1.format(1234.5), nf2.format(1234.5));

// Unfrozen options must never alias a frozen entry: mutating the object and
// constructing again must reflect the mutation, not a stale memo.
var unfrozen = { year: "numeric", month: "short", day: "numeric" };
var f3 = new Intl.DateTimeFormat("en-US", unfrozen);
assertEq(f3.format(d), f1.format(d));
unfrozen.year = "2-digit";
var f4 = new Intl.DateTimeFormat("en-US", unfrozen);
assertEq(f4.format(d) !== f1.format(d), true);
