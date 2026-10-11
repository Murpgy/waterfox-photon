#filter dumbComments emptyLines

// Photon-classic additive overlay. All rules gate on
// browser.theme.waterfox.browserStyle == "photon-classic" so the
// style is inert for nova/proton/photon profiles.

pref("userChrome.photon-classic.tabs.enabled", true);
pref("userChrome.photon-classic.tabs.separators", true);
pref("userChrome.photon-classic.tabs.top-line", true);
pref("userChrome.photon-classic.toolbar.enabled", true);
pref("userChrome.photon-classic.toolbar.square-buttons", true);
pref("userChrome.photon-classic.urlbar.enabled", true);
pref("userChrome.photon-classic.urlbar.no-breakout", true);
pref("userChrome.photon-classic.panel.enabled", true);
pref("userChrome.photon-classic.panel.icons", true);
pref("userChrome.photon-classic.menus.enabled", true);
