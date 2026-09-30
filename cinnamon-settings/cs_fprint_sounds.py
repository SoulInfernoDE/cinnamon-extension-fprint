#!/usr/bin/python3
# Copyright (C) 2026 soul-inferno <nofunction@gmx.net>
#
# This file is part of cinnamon-extension-fprint, from the greeter-fprint
# family, and is licensed under the GNU General Public License version 3.

"""
"Fingerprint sounds" in System Settings, under Hardware next to Sound.

cinnamon-settings loads every cs_*.py in its modules directory, so this page is
a file of its own there: nothing of Cinnamon's is changed or replaced. It sets
io.github.soulinfernode.fprint-sounds volume - the same value as the slider
this extension adds to the sound applet - and plays a sample at that level.

A page of its own rather than a row on the Sound page, deliberately: the Sound
page is cs_sound.py, and "cinnamon-settings sound" - which the applet's "Sound
Settings" opens - imports nothing else, so a row there would need Cinnamon's
file itself replaced.

Open it directly with: cinnamon-settings fprint_sounds
"""

import gettext
import math
import os
import sys
import traceback

from gi.repository import Gio, GLib, Gtk

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import GSettingsRange, SettingsPage, SettingsWidget

DOMAIN = "greeter-fprint-polkit@soulinferno"
SCHEMA = "io.github.soulinfernode.fprint-sounds"
MEDIA_ROLE = "fingerprint"
PREVIEW = "/usr/share/greeter-fprint/sounds/fingerprint-success.oga"

# Not "_": cinnamon-settings installs its own _ (domain "cinnamon") into
# builtins, and this module's strings live in the extension's catalogue.
_f = gettext.translation(DOMAIN, "/usr/share/locale", fallback=True).gettext


def schema_installed():
    source = Gio.SettingsSchemaSource.get_default()
    return source is not None and source.lookup(SCHEMA, True) is not None


def volume_db(percent):
    """Whole-decibel gain for canberra.volume, or None for silence. The same
    conversion as the real sounds (greeter-fprint's session_sounds), so the
    sample sounds exactly like a prompt will."""
    if percent <= 0:
        return None
    return int(round(60 * math.log10(min(percent, 100) / 100)))


class PreviewButton(SettingsWidget):
    def __init__(self, settings):
        super(PreviewButton, self).__init__()
        self.settings = settings
        self.context = None
        label = Gtk.Label(label=_f("Play a sample at this volume"))
        label.set_xalign(0.0)
        self.pack_start(label, True, True, 0)
        button = Gtk.Button(label=_f("Test sound"))
        button.connect("clicked", self.on_clicked)
        self.pack_end(button, False, False, 0)

    def on_clicked(self, button):
        gain = volume_db(self.settings.get_int("volume"))
        if gain is None or not os.path.exists(PREVIEW):
            return
        try:
            if self.context is None:
                import gi
                gi.require_version("GSound", "1.0")
                from gi.repository import GSound
                context = GSound.Context()
                context.init(None)
                self.context = context
            self.context.play_simple({"media.filename": PREVIEW,
                                      "media.role": MEDIA_ROLE,
                                      "canberra.volume": str(gain)}, None)
        except Exception:
            sys.stderr.write(traceback.format_exc())


class Module:
    name = "fprint_sounds"
    category = "hardware"
    comment = _f("Volume of the fingerprint sounds")

    def __init__(self, content_box):
        keywords = _f("fingerprint, reader, sound, volume")
        icon = "fingwit" if Gtk.IconTheme.get_default().has_icon("fingwit") else "cs-sound"
        self.sidePage = SidePage(_f("Fingerprint sounds"), icon, keywords, content_box, module=self)

    # Without greeter-fprint's schema there is nothing to set: no page at all.
    def _loadCheck(self):
        return schema_installed()

    def on_module_selected(self):
        if self.loaded:
            return
        print("Loading Fingerprint sounds module")

        page = SettingsPage()
        self.sidePage.add_widget(page)

        section = page.add_section(
            _f("Fingerprint sounds"),
            _f("At the login screen, on the lock screen, for sudo and pkexec in a terminal, and in authentication dialogs. At 0 % they are silent."))

        volume = GSettingsRange(_f("Volume"), SCHEMA, "volume", _f("Quiet"), _f("Loud"),
                                show_value=True, units="%")
        section.add_row(volume)
        section.add_row(PreviewButton(Gio.Settings(schema_id=SCHEMA)))
