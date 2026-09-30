// Copyright (C) 2026 soul-inferno <nofunction@gmx.net>
//
// This file is part of cinnamon-extension-fprint, from the greeter-fprint
// family, and is licensed under the GNU General Public License version 3.

// A "Fingerprint sounds" slider in Cinnamon's sound applet, right below the
// main volume slider. It sets io.github.soulinfernode.fprint-sounds volume -
// the level greeter-fprint's session sounds and screensaver-fprint's lock
// screen play their fingerprint sounds at - and lets the user hear the result.
//
// The applet is extended the way the authentication dialog is: at runtime,
// without touching Cinnamon's files. _showFixedElements() is where the applet
// builds its menu, so wrapping it on the applet's prototype puts the slider
// into every menu it builds, including menus of instances created later;
// instances already running get theirs directly. disable() undoes both.

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Gettext = imports.gettext;
const AppletManager = imports.ui.appletManager;
const PopupMenu = imports.ui.popupMenu;
const Tooltips = imports.ui.tooltips;

const DOMAIN = "greeter-fprint-polkit@soulinferno";
const SOUND_APPLET = "sound@cinnamon.org";
const SCHEMA = "io.github.soulinfernode.fprint-sounds";
// The sounds' own media role - see volumeDb(). The preview uses it too, so
// what the user hears while dragging is exactly what a prompt will sound like.
const MEDIA_ROLE = "fingerprint";
const PREVIEW = "/usr/share/greeter-fprint/sounds/fingerprint-success.oga";
const PREVIEW_DELAY_MS = 250;
const ATTACH_TRIES = 15;
const ATTACH_INTERVAL_S = 2;

function _(text) {
    return Gettext.dgettext(DOMAIN, text);
}

function report(where, e) {
    global.logError(`greeter-fprint-polkit: ${where}: ${e}`);
}

let settings = null;
let patchedProto = null;
let originalShowFixed = null;
let attachId = 0;
let soundContext = null;

// The slider's percent as the whole-decibel gain canberra.volume takes, or
// null for silence: cubic like PulseAudio's percentages, and whole decibels
// because canberra parses the value with strtod() under Cinnamon's
// LC_NUMERIC. The same function as in greeter-fprint and screensaver-fprint.
function volumeDb(percent) {
    if (percent <= 0)
        return null;
    return Math.round(60 * Math.log10(Math.min(percent, 100) / 100));
}

function playPreview() {
    const gain = volumeDb(settings.get_int("volume"));
    if (gain === null || !GLib.file_test(PREVIEW, GLib.FileTest.EXISTS))
        return;
    try {
        if (!soundContext) {
            if (!imports.gi.versions.GSound)
                imports.gi.versions.GSound = "1.0";
            const GSound = imports.gi.GSound;
            soundContext = new GSound.Context();
            soundContext.init(null);
        }
        soundContext.play_simple({
            "media.filename": PREVIEW,
            "media.role": MEDIA_ROLE,
            "canberra.volume": String(gain),
        }, null);
    } catch (e) {
        report("preview", e);
    }
}

class FingerprintSoundSlider extends PopupMenu.PopupSliderMenuItem {
    constructor() {
        super(settings.get_int("volume") / 100);

        this.icon = new St.Icon({
            icon_name: "auth-fingerprint-symbolic",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 16,
        });
        // Laid out like the applet's own VolumeSlider: icon, then slider.
        this.removeActor(this._slider);
        this.addActor(this.icon, { span: 0 });
        this.addActor(this._slider, { span: -1, expand: true });

        this.tooltip = new Tooltips.Tooltip(this.actor, "");
        this._syncing = false;
        this._previewId = 0;

        this.connect("value-changed", () => this._onValueChanged());
        // drag-end also comes after every scroll step; play once it settles.
        this.connect("drag-end", () => this._schedulePreview());
        this._changedId = settings.connect("changed::volume", () => this._sync());
        this.connect("destroy", () => {
            this.destroyed = true;
            if (this._previewId)
                GLib.source_remove(this._previewId);
            if (settings)
                settings.disconnect(this._changedId);
        });
        this._sync();
    }

    _onValueChanged() {
        if (this._syncing)
            return;
        const percent = Math.round(this.value * 100);
        if (settings.get_int("volume") !== percent)
            settings.set_int("volume", percent);
        this._showPercent(percent);
    }

    // Follows the setting when something else changes it: System Settings,
    // another panel's applet, dconf.
    _sync() {
        const percent = settings.get_int("volume");
        this._syncing = true;
        this.setValue(percent / 100);
        this._syncing = false;
        this._showPercent(percent);
    }

    _showPercent(percent) {
        this.tooltip.set_text(`${_("Fingerprint sounds")}: ${percent}%`);
    }

    _schedulePreview() {
        if (this._previewId)
            GLib.source_remove(this._previewId);
        this._previewId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, PREVIEW_DELAY_MS, () => {
            this._previewId = 0;
            playPreview();
            return GLib.SOURCE_REMOVE;
        });
    }
}

function addSlider(applet) {
    if (!settings || !applet.menu || !applet._outputVolumeSection)
        return;
    if (applet._gfpSoundSlider && !applet._gfpSoundSlider.destroyed)
        return;
    const index = applet.menu._getMenuItems().indexOf(applet._outputVolumeSection);
    const slider = new FingerprintSoundSlider();
    applet.menu.addMenuItem(slider, index >= 0 ? index + 1 : undefined);
    applet._gfpSoundSlider = slider;
}

function attach() {
    const applets = AppletManager.getRunningInstancesForUuid(SOUND_APPLET) || [];
    if (applets.length === 0)
        return false;

    const proto = Object.getPrototypeOf(applets[0]);
    if (!patchedProto && typeof proto._showFixedElements === "function") {
        patchedProto = proto;
        originalShowFixed = proto._showFixedElements;
        proto._showFixedElements = function (...args) {
            const result = originalShowFixed.apply(this, args);
            try {
                addSlider(this);
            } catch (e) {
                report("_showFixedElements", e);
            }
            return result;
        };
    }
    for (const applet of applets) {
        try {
            addSlider(applet);
        } catch (e) {
            report("addSlider", e);
        }
    }
    return true;
}

// GLib reads the compiled schema database once, when a process starts, and
// Cinnamon runs for the whole session: a schema installed after login is
// invisible to the default source until Cinnamon restarts. So if the default
// source does not know it, the installed database is read afresh. The Settings
// object still uses the ordinary dconf backend, shared with every other process.
function lookupSchema() {
    const source = Gio.SettingsSchemaSource.get_default();
    let schema = source ? source.lookup(SCHEMA, true) : null;
    if (schema)
        return schema;
    for (const dir of GLib.get_system_data_dirs()) {
        const path = GLib.build_filenamev([dir, "glib-2.0", "schemas"]);
        if (!GLib.file_test(GLib.build_filenamev([path, "gschemas.compiled"]), GLib.FileTest.EXISTS))
            continue;
        try {
            schema = Gio.SettingsSchemaSource.new_from_directory(path, null, false).lookup(SCHEMA, false);
        } catch (e) {
            report("lookupSchema", e);
        }
        if (schema)
            return schema;
    }
    return null;
}

function enable() {
    const schema = lookupSchema();
    if (!schema) {
        // greeter-fprint installs the schema; without it there is nothing to set.
        global.log(`greeter-fprint-polkit: ${SCHEMA} is not installed, no sound slider`);
        return;
    }
    settings = new Gio.Settings({ settings_schema: schema });

    // Extensions can start before the panel's applets have; try again a few
    // times rather than give up on the first look.
    let tries = 0;
    if (!attach()) {
        attachId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, ATTACH_INTERVAL_S, () => {
            tries += 1;
            if (attach() || tries >= ATTACH_TRIES) {
                attachId = 0;
                return GLib.SOURCE_REMOVE;
            }
            return GLib.SOURCE_CONTINUE;
        });
    }
}

function disable() {
    if (attachId) {
        GLib.source_remove(attachId);
        attachId = 0;
    }
    if (patchedProto) {
        patchedProto._showFixedElements = originalShowFixed;
        patchedProto = null;
        originalShowFixed = null;
    }
    for (const applet of AppletManager.getRunningInstancesForUuid(SOUND_APPLET) || []) {
        if (applet._gfpSoundSlider) {
            if (!applet._gfpSoundSlider.destroyed)
                applet._gfpSoundSlider.destroy();
            applet._gfpSoundSlider = null;
        }
    }
    settings = null;
}
