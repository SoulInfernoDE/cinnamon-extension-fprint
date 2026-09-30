#!/usr/bin/python3
"""Captures the volume preview from the running desktop: the sound applet's two
sliders and the "Fingerprint sounds" page of System Settings, at 100, 80, 60,
45 and 30 %, in German and in English.

It sets the user's real fingerprint volume for each step - that is what makes
both controls move together - and puts the original back at the end, whatever
happens. The settings window opens twice, once per language, and the applet
menu opens once per step; don't click while it runs (about 30 s).

The menu is opened and closed once before the first capture: on its first open
it is still settling, and the rows came out 11 px lower than on every later one.

usage: capture-volume.py OUTDIR   (then make-volume-gif.py OUTDIR)
"""
import json
import os
import subprocess
import sys
import time

from gi.repository import Gio, GLib

OUT = sys.argv[1]
VALUES = [100, 80, 60, 45, 30]
SCHEMA = "io.github.soulinfernode.fprint-sounds"
APPLET = "imports.ui.appletManager.getRunningInstancesForUuid('sound@cinnamon.org')[0]"

bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)


def ev(code):
    ok, result = bus.call_sync("org.Cinnamon", "/org/Cinnamon", "org.Cinnamon", "Eval",
                               GLib.Variant("(s)", (code,)), None, Gio.DBusCallFlags.NONE,
                               10000, None).unpack()
    return json.loads(result) if result else None


def shot(x, y, w, h, path):
    ev(f"(function(){{ new imports.gi.Cinnamon.Screenshot().screenshot_area("
       f"false, {x}, {y}, {w}, {h}, '{path}', () => {{}}); return 1; }})()")
    for _ in range(60):
        if os.path.exists(path) and os.path.getsize(path) > 0:
            return
        time.sleep(0.05)


WINDOW = """(function(){ const w = global.get_window_actors().map(a => a.meta_window)
  .find(w => (w.get_wm_class() || '').toLowerCase().includes('cinnamon-settings'));
  if (!w) return null; const r = w.get_frame_rect(); return [r.x, r.y, r.width, r.height]; })()"""
MENU = f"""(function(){{ const a = {APPLET}; if (!a._gfpSoundSlider) return null; a.menu.open(false);
  const rect = (actor) => {{ const [x, y] = actor.get_transformed_position();
    const [w, h] = actor.get_transformed_size(); return [x, y, x + w, y + h]; }};
  const r1 = rect(a._outputVolumeSection.actor), r2 = rect(a._gfpSoundSlider.actor), m = rect(a.menu.box);
  return [Math.round(m[0]), Math.round(Math.min(r1[1], r2[1]) - 6), Math.round(m[2] - m[0]),
          Math.round(Math.max(r1[3], r2[3]) - Math.min(r1[1], r2[1]) + 12)]; }})()"""
CLOSE = f"(function(){{ {APPLET}.menu.close(false); return 1; }})()"

for d in ("de", "en", "menu"):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

volume = Gio.Settings(schema_id=SCHEMA)
original = volume.get_int("volume")
try:
    ev(MENU); time.sleep(0.6); ev(CLOSE); time.sleep(0.4)
    for lang, env in (("de", {"LANG": "de_DE.UTF-8", "LC_ALL": "de_DE.UTF-8", "LANGUAGE": "de"}),
                      ("en", {"LANG": "C.UTF-8", "LC_ALL": "C.UTF-8", "LANGUAGE": "en"})):
        volume.set_int("volume", VALUES[0]); Gio.Settings.sync()
        proc = subprocess.Popen(["cinnamon-settings", "fprint_sounds"], env={**os.environ, **env},
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            if ev(WINDOW):
                break
            time.sleep(0.1)
        time.sleep(1.5)
        window = ev(WINDOW)
        for v in VALUES:
            volume.set_int("volume", v); Gio.Settings.sync(); time.sleep(0.6)
            shot(*window, os.path.join(OUT, lang, f"{v}.png"))
            if lang == "de":
                menu = ev(MENU); time.sleep(0.5)
                shot(*menu, os.path.join(OUT, "menu", f"{v}.png"))
                ev(CLOSE); time.sleep(0.3)
        proc.terminate()
        proc.wait(5)
        time.sleep(0.8)
finally:
    try:
        ev(CLOSE)
    except Exception:
        pass
    volume.set_int("volume", original)
    Gio.Settings.sync()
    print(f"volume restored to {volume.get_int('volume')} %")
