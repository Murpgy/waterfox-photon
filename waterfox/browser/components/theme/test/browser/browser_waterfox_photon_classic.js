/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { WaterfoxBrowserStyle } = ChromeUtils.importESModule(
  "resource:///modules/WaterfoxBrowserStyle.sys.mjs"
);
const { WaterfoxTheme } = ChromeUtils.importESModule(
  "resource:///modules/WaterfoxTheme.sys.mjs"
);

const NOVA_PREF = "browser.nova.enabled";
const STYLE_PREF = "browser.theme.waterfox.browserStyle";
const DENSITY_PREF = "browser.uidensity";
const CHROME_SHEET_PREF = "browser.theme.waterfox.chromeSheet";

const OVERLAY_GATES = [
  "userChrome.photon-classic.tabs.enabled",
  "userChrome.photon-classic.tabs.separators",
  "userChrome.photon-classic.tabs.top-line",
  "userChrome.photon-classic.toolbar.enabled",
  "userChrome.photon-classic.toolbar.square-buttons",
  "userChrome.photon-classic.urlbar.enabled",
  "userChrome.photon-classic.urlbar.no-breakout",
  "userChrome.photon-classic.panel.enabled",
  "userChrome.photon-classic.panel.icons",
  "userChrome.photon-classic.menus.enabled",
];

function reset() {
  for (const pref of [
    NOVA_PREF,
    STYLE_PREF,
    DENSITY_PREF,
    CHROME_SHEET_PREF,
    ...WaterfoxBrowserStyle.STYLE_PREFS,
    ...OVERLAY_GATES,
  ]) {
    if (Services.prefs.prefHasUserValue(pref)) {
      Services.prefs.clearUserPref(pref);
    }
  }
}

function rootVar(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
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

add_task(function test_photon_classic_overlay_gates() {
  const defaults = Services.prefs.getDefaultBranch("");
  for (const pref of OVERLAY_GATES) {
    ok(
      defaults.getBoolPref(pref, false),
      `${pref} defaults to true so each area is independently kill-switchable`
    );
  }
});

add_task(function test_all_styles_sync_nova() {
  for (const [style, nova] of [
    ["nova", true],
    ["proton", false],
    ["photon", false],
    ["photon-classic", true],
  ]) {
    reset();
    WaterfoxBrowserStyle.setStyle(style);
    is(WaterfoxBrowserStyle.getStyle(), style, `${style} is selected`);
    is(
      Services.prefs.getBoolPref(NOVA_PREF),
      nova,
      `${style} keeps Nova ${nova ? "enabled" : "disabled"}`
    );
  }
  reset();
  WaterfoxBrowserStyle.applyStyle("nova");
});

add_task(async function test_photon_classic_sheets_packaged() {
  const sheets = [
    ["chrome://browser/skin/photon-classic/tokens.css", "--tab-min-height"],
    ["chrome://browser/skin/photon-classic/chrome/tabs.css", ".tab-background"],
    [
      "chrome://browser/skin/photon-classic/chrome/toolbar.css",
      "--toolbarbutton-padding-inner",
    ],
    [
      "chrome://browser/skin/photon-classic/chrome/urlbar.css",
      ".urlbar-background",
    ],
    [
      "chrome://browser/skin/photon-classic/chrome/panelUI.css",
      ".subviewbutton",
    ],
    ["chrome://browser/skin/photon-classic/chrome/menus.css", "menupopup"],
  ];
  for (const [url, marker] of sheets) {
    const response = await fetch(url);
    ok(response.ok, `${url} is packaged`);
    const text = await response.text();
    ok(text.includes(marker), `${url} contains ${marker}`);
  }
  const svg = await fetch(
    "chrome://browser/content/waterfox/style/waterfox-style-photon-classic.svg"
  );
  ok(svg.ok, "photon-classic picker preview is packaged");
});

add_task(function test_photon_classic_live_tokens() {
  reset();
  // Pin normal density: Waterfox ships compact by default, whose values
  // coincide with upstream compact defaults and would false-pass.
  Services.prefs.setIntPref(DENSITY_PREF, 0);
  WaterfoxBrowserStyle.setStyle("photon-classic");
  is(
    rootVar("--tab-min-height"),
    "33px",
    "photon-classic sets the Photon tab height (upstream Nova is 32px)"
  );
  is(
    rootVar("--tab-block-margin"),
    "0px",
    "photon-classic zeroes the tab block margin"
  );
  is(rootVar("--tab-border-radius"), "0px", "photon-classic uses square tabs");
  is(
    rootVar("--toolbarbutton-padding-inner"),
    "8px",
    "photon-classic uses dense Photon button padding"
  );
  is(
    rootVar("--panel-subview-body-padding-block"),
    "4px",
    "photon-classic uses dense Photon menu padding"
  );
  const tabBackground = document.querySelector(
    ".tabbrowser-tab .tab-background"
  );
  ok(tabBackground, "tab background element exists for element-level check");
  if (tabBackground) {
    is(
      getComputedStyle(tabBackground).borderRadius,
      "0px",
      "photon-classic renders square tab backgrounds"
    );
  }

  WaterfoxBrowserStyle.setStyle("nova");
  isnot(
    rootVar("--tab-block-margin"),
    "0px",
    "nova restores the floating tab margin once classic is off"
  );
  isnot(
    rootVar("--tab-border-radius"),
    "0px",
    "nova restores rounded tabs once classic is off"
  );
  reset();
  WaterfoxBrowserStyle.applyStyle("nova");
});

add_task(function test_photon_classic_densities() {
  reset();
  WaterfoxBrowserStyle.setStyle("photon-classic");
  for (const [density, height, padding] of [
    [1, "29px", "6px"],
    [2, "41px", "9px"],
  ]) {
    Services.prefs.setIntPref(DENSITY_PREF, density);
    is(
      rootVar("--tab-min-height"),
      height,
      `photon-classic tab height at density ${density}`
    );
    is(
      rootVar("--toolbarbutton-padding-inner"),
      padding,
      `photon-classic button padding at density ${density}`
    );
  }
  reset();
  WaterfoxBrowserStyle.applyStyle("nova");
});

add_task(function test_photon_classic_respects_vertical_tabs() {
  reset();
  Services.prefs.setIntPref(DENSITY_PREF, 0);
  Services.prefs.setBoolPref("sidebar.verticalTabs", true);
  WaterfoxBrowserStyle.setStyle("photon-classic");
  isnot(
    rootVar("--tab-min-height"),
    "33px",
    "vertical layouts keep stock metrics under photon-classic"
  );
  Services.prefs.clearUserPref("sidebar.verticalTabs");
  reset();
  WaterfoxBrowserStyle.applyStyle("nova");
});

add_task(function test_photon_classic_sheet_gating() {
  reset();
  WaterfoxBrowserStyle.setStyle("photon-classic");
  ok(
    WaterfoxTheme.shouldLoadPhoton(),
    "photon sheet loads while classic is selected and sheets are on"
  );
  Services.prefs.setIntPref(CHROME_SHEET_PREF, 2);
  ok(
    !WaterfoxTheme.shouldLoadPhoton(),
    "chromeSheet off kills the photon sheet"
  );
  reset();
  WaterfoxBrowserStyle.applyStyle("nova");
});

add_task(function test_photon_classic_kill_switches() {
  reset();
  WaterfoxBrowserStyle.setStyle("photon-classic");
  for (const pref of OVERLAY_GATES) {
    Services.prefs.setBoolPref(pref, false);
    is(
      WaterfoxBrowserStyle.getStyle(),
      "photon-classic",
      `${pref}=false keeps the style selected`
    );
    Services.prefs.clearUserPref(pref);
  }
  reset();
  WaterfoxBrowserStyle.applyStyle("nova");
});
