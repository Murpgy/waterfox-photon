#!/usr/bin/env python3
"""Coherence checks for the photon-classic theme overlay.

Verifies that manifests, chrome imports, pref gates, style options,
presets, preview assets and onboarding tiles agree with each other,
without needing a build. Exits nonzero on the first batch of failures.
"""

import glob
import os
import re
import sys

ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
failures = []


def fail(message):
    failures.append(message)
    print(f"FAIL: {message}")


def tree(path):
    return os.path.join(ROOT, path.replace("/", os.sep))


def read(path):
    with open(tree(path), encoding="utf-8") as handle:
        return handle.read()


def check_exists(path, context):
    if not os.path.exists(tree(path)):
        fail(f"{context}: missing {path}")


# 1. jar.mn skin entries resolve to real files.
for manifest in [
    "waterfox/browser/themes/jar.mn",
    "waterfox/browser/components/theme/jar.mn",
]:
    base = os.path.dirname(manifest)
    for line in read(manifest).splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "(" not in line:
            continue
        source = line.rsplit("(", 1)[1].rstrip(")").strip()
        if "*" in source:
            if not glob.glob(tree(f"{base}/{source}")):
                fail(f"{manifest}: glob matches nothing: {source}")
        else:
            check_exists(f"{base}/{source}", manifest)

# 2. waterfoxChrome.css skin imports resolve into waterfox/browser/themes/.
chrome_css = read("waterfox/browser/themes/waterfox/waterfoxChrome.css")
for url in re.findall(r'@import url\("([^"]+)"\)', chrome_css):
    if url.startswith("chrome://browser/skin/"):
        check_exists(
            f"waterfox/browser/themes/{url[len('chrome://browser/skin/'):]}",
            "waterfoxChrome.css",
        )

# 3. Every -moz-pref gate in photon-classic CSS has a default pref.
declared = set(
    re.findall(
        r'pref\("([^"]+)"',
        read("waterfox/browser/themes/photon-classic/prefs-photon-classic.js"),
    )
) | set(
    re.findall(
        r'pref\("([^"]+)"', read("waterfox/browser/themes/lepton/prefs-lepton.js")
    )
)
# Prefs that intentionally have no pref() default: sidebar.verticalTabs is
# upstream-owned, and browserStyle defaults to "" (derived from NOVA_PREF in
# WaterfoxBrowserStyle.getStyle) until the user picks a style.
NO_DEFAULT_PREFS = frozenset(
    {"sidebar.verticalTabs", "browser.theme.waterfox.browserStyle"}
)
for css in glob.glob(
    tree("waterfox/browser/themes/photon-classic/**/*.css"), recursive=True
):
    with open(css, encoding="utf-8") as handle:
        text = handle.read()
    for pref in re.findall(r'-moz-pref\("([^"]+)"', text):
        if pref in NO_DEFAULT_PREFS:
            continue
        if pref not in declared:
            fail(
                f"{os.path.relpath(css, ROOT)}: -moz-pref({pref}) "
                "has no default in prefs-lepton.js or prefs-photon-classic.js"
            )

# 4. Picker options, presets and preview SVGs agree.
appearance = read("waterfox/browser/components/settings/waterfoxAppearance.mjs")
options = re.findall(r'value: "([a-z-]+)",\s*l10nId:', appearance)
style = read("waterfox/browser/components/theme/WaterfoxBrowserStyle.sys.mjs")
presets = {
    name.strip('"') for name in re.findall(r"^\s{2}(\"?[a-z-]+\"?):", style, re.M)
}
for option in options:
    if option not in ("nova", "proton", "photon", "photon-classic"):
        continue
    if option not in presets:
        fail(f"BROWSER_STYLE_OPTIONS has {option} with no PRESETS entry")
    check_exists(
        f"waterfox/browser/components/theme/waterfox-style-{option}.svg",
        "BROWSER_STYLE_OPTIONS",
    )

# 5. Style tiles only reference known styles and packaged SVGs.
onboarding = read("waterfox/browser/components/onboarding/content/onboarding.html")
style_tiles = re.search(
    r'<div class="tile-row" id="style-tiles">(.*?)</div>', onboarding, re.S
)
if not style_tiles:
    fail("onboarding.html: #style-tiles block not found")
else:
    values = re.findall(r'data-value="([a-z-]+)"', style_tiles.group(1))
    sources = re.findall(r'src="([^"]+)"', style_tiles.group(1))
    if len(values) != len(sources) or not values:
        fail("onboarding.html: style tiles and previews out of sync")
    for value, src in zip(values, sources):
        if value not in presets:
            fail(f"onboarding.html: tile {value} has no PRESETS entry")
        if src.startswith("chrome://browser/content/waterfox/style/"):
            check_exists(
                "waterfox/browser/components/theme/"
                f"{src[len('chrome://browser/content/waterfox/style/'):]}",
                "onboarding.html",
            )

if failures:
    print(f"{len(failures)} coherence check(s) failed", file=sys.stderr)
    sys.exit(1)
print("theme coherence checks passed")
