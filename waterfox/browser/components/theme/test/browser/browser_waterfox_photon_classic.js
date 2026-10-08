/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { WaterfoxBrowserStyle } = ChromeUtils.importESModule(
  "resource:///modules/WaterfoxBrowserStyle.sys.mjs"
);

const NOVA_PREF = "browser.nova.enabled";
const STYLE_PREF = "browser.theme.waterfox.browserStyle";

function reset() {
  for (const pref of [
    NOVA_PREF,
    STYLE_PREF,
    ...WaterfoxBrowserStyle.STYLE_PREFS,
  ]) {
    if (Services.prefs.prefHasUserValue(pref)) {
      Services.prefs.clearUserPref(pref);
    }
  }
}

registerCleanupFunction(reset);

add_task(function test_photon_classic_preset_exists() {
  const preset = WaterfoxBrowserStyle.PRESETS["photon-classic"];
  ok(preset, "photon-classic preset is registered");
  is(
    preset["userChrome.tab.static_separator"],
    true,
    "photon-classic uses static Photon separators"
  );
  is(
    preset["userChrome.rounding.square_tab"],
    true,
    "photon-classic uses square tabs"
  );
  is(
    preset["userChrome.tab.photon_like_padding"],
    true,
    "photon-classic uses Photon padding"
  );
});

add_task(function test_photon_classic_keeps_nova() {
  reset();
  WaterfoxBrowserStyle.setStyle("photon-classic");
  is(
    WaterfoxBrowserStyle.getStyle(),
    "photon-classic",
    "photon-classic is selected"
  );
  ok(
    Services.prefs.getBoolPref(NOVA_PREF, false),
    "photon-classic keeps Nova enabled for cheap token overrides"
  );
  const defaults = Services.prefs.getDefaultBranch("");
  ok(
    Object.entries(WaterfoxBrowserStyle.PHOTON_CLASSIC_PRESET).every(
      ([pref, value]) => defaults.getBoolPref(pref) == value
    ),
    "photon-classic receives its defaults"
  );
  reset();
  WaterfoxBrowserStyle.applyStyle("nova");
});
