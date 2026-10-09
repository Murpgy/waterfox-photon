/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  StyleSheetUtils: "resource:///modules/StyleSheetUtils.sys.mjs",
  WaterfoxBrowserStyle: "resource:///modules/WaterfoxBrowserStyle.sys.mjs",
});

const CHROME_SHEET_PREF = "browser.theme.waterfox.chromeSheet";
const CHROME_SHEET_OFF = 2;
const BROWSER_STYLE_PREF = "browser.theme.waterfox.browserStyle";

const USERCHROME_URI = "chrome://browser/skin/userChrome.css";
// Register userContent.css globally to reach about: pages and web content.
const USERCONTENT_URI = "chrome://browser/skin/userContent.css";
// Photon-classic loads per-window only while selected, so the chromeSheet
// kill-switch and style switches both apply without touching upstream.
const PHOTON_CLASSIC_URI = "chrome://browser/skin/photon-classic.css";
const BROWSER_WINDOW_TYPE = "navigator:browser";

export const WaterfoxTheme = {
  stylesEnabled: false,
  photonEnabled: false,
  photonDocuments: new WeakSet(),
  _initialized: false,

  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    Services.prefs.addObserver(CHROME_SHEET_PREF, this);
    Services.prefs.addObserver(BROWSER_STYLE_PREF, this);
    Services.obs.addObserver(this, "chrome-document-loaded");
    this.update();
  },

  observe(subject, topic) {
    switch (topic) {
      case "nsPref:changed":
        this.update();
        break;
      case "chrome-document-loaded": {
        const win = subject.defaultView;
        if (this.stylesEnabled && win?.windowUtils) {
          try {
            win.windowUtils.loadSheetUsingURIString(
              USERCHROME_URI,
              Ci.nsIStyleSheetService.USER_SHEET
            );
          } catch (_e) {}
        }
        if (
          this.photonEnabled &&
          win?.windowUtils &&
          subject.documentElement?.getAttribute("windowtype") ==
            BROWSER_WINDOW_TYPE &&
          !this.photonDocuments.has(subject)
        ) {
          try {
            win.windowUtils.loadSheetUsingURIString(
              PHOTON_CLASSIC_URI,
              Ci.nsIStyleSheetService.USER_SHEET
            );
            this.photonDocuments.add(subject);
          } catch (_e) {}
        }
        break;
      }
    }
  },

  shouldLoad() {
    return Services.prefs.getIntPref(CHROME_SHEET_PREF, 0) != CHROME_SHEET_OFF;
  },

  shouldLoadPhoton() {
    return (
      this.shouldLoad() &&
      lazy.WaterfoxBrowserStyle.getStyle() == "photon-classic"
    );
  },

  update() {
    if (this.shouldLoad()) {
      this.load();
    } else {
      this.unload();
    }
    this.updatePhoton();
  },

  load() {
    if (this.stylesEnabled) {
      return;
    }
    this._forEachChromeWindow(win => {
      win.windowUtils.loadSheetUsingURIString(
        USERCHROME_URI,
        Ci.nsIStyleSheetService.USER_SHEET
      );
    });
    lazy.StyleSheetUtils.registerStylesheet(USERCONTENT_URI);
    this.stylesEnabled = true;
  },

  unload() {
    if (!this.stylesEnabled) {
      return;
    }
    this._forEachChromeWindow(win => {
      win.windowUtils.removeSheetUsingURIString(
        USERCHROME_URI,
        Ci.nsIStyleSheetService.USER_SHEET
      );
    });
    lazy.StyleSheetUtils.unregisterStylesheet(USERCONTENT_URI);
    this.stylesEnabled = false;
  },

  _forEachChromeWindow(callback) {
    for (const win of Services.wm.getEnumerator(null)) {
      try {
        callback(win);
      } catch (_e) {}
    }
  },

  _forEachBrowserWindow(callback) {
    for (const win of Services.wm.getEnumerator(BROWSER_WINDOW_TYPE)) {
      try {
        callback(win);
      } catch (_e) {}
    }
  },

  loadPhoton() {
    this._forEachBrowserWindow(win => {
      if (!win?.windowUtils || !win.document) {
        return;
      }
      win.windowUtils.loadSheetUsingURIString(
        PHOTON_CLASSIC_URI,
        Ci.nsIStyleSheetService.USER_SHEET
      );
      this.photonDocuments.add(win.document);
    });
    this.photonEnabled = true;
  },

  unloadPhoton() {
    if (!this.photonEnabled) {
      return;
    }
    this._forEachBrowserWindow(win => {
      try {
        win?.windowUtils?.removeSheetUsingURIString(
          PHOTON_CLASSIC_URI,
          Ci.nsIStyleSheetService.USER_SHEET
        );
      } catch (_e) {}
    });
    this.photonDocuments = new WeakSet();
    this.photonEnabled = false;
  },

  updatePhoton() {
    if (this.shouldLoadPhoton()) {
      if (!this.photonEnabled) {
        this.loadPhoton();
      }
    } else {
      this.unloadPhoton();
    }
  },
};
