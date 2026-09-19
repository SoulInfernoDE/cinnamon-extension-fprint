// Copyright (C) 2026 soul-inferno <nofunction@gmx.net>
//
// This file is part of cinnamon-extension-fprint, from the greeter-fprint family, and is
// licensed under the GNU General Public License version 3. See COPYING.

// Gives Cinnamon's authentication dialog (pkexec, software installs, anything
// polkit asks for) the fingerprint states of greeter-fprint's login screen:
// the title glows yellow while the reader waits, red for a rejected finger and
// green when accepted, and the reader's message takes the matching colour -
// translated, where polkit's helper hands it over in English.
//
// It patches imports.ui.polkitAuthenticationAgent.AuthenticationDialog at
// runtime rather than replacing Cinnamon's file, which an update would undo.
// Every patched method calls the original, and every addition is guarded: this
// is an authentication dialog, and a colour that fails to change is cosmetic
// where a dialog that throws is not. Nothing here touches the authentication
// itself - only when the original's result is shown.

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const PolkitAgent = imports.ui.polkitAuthenticationAgent;

let Messages = null;
let originals = null;

// greeter-fprint's own values: FingerprintPanel.FLASH_MS, and the colours of
// apply_label_colour() / state_glow_rgba() in src/fingerprint-panel.vala.
const FLASH_MS = 1500;
const COLOURS = {
    waiting: [255, 204, 26],
    failure: [230, 56, 54],
    success: [61, 184, 87],
};

// While the reader is in charge, the "Authenticate" button has nothing to do:
// it only ever sends the password entry's text, and there is no password yet.
// It shows the Mint logo instead, glowing like the one Tux holds on the login
// screen, and becomes a button again when the password is asked for. The logo
// is the system's own icon - not shipped here - with a generic fingerprint
// icon where it is missing.
//
// Loaded by path, the way greeter-fprint loads it. Cinnamon's St.Icon is older
// than GNOME's - no fallback-icon-name, which threw on every message - and
// looked up by name it settled on the fallback even though GTK finds the logo;
// a Gio.FileIcon on the -symbolic.svg sidesteps the lookup and stays tintable.
//
// The glow is a radial gradient on a disc behind the icon: the colour at the
// centre, fading to nothing at the edge - the light greeter-fprint draws behind
// the logo. A background is always painted; a box-shadow on a disc without one
// was not, which left nothing visible to breathe.
const LOGO_FILE = "/usr/share/icons/hicolor/scalable/apps/linuxmint-logo-badge-symbolic.svg";
const LOGO_FALLBACK = "auth-fingerprint-symbolic";
const LOGO_SIZE = 26;
const GLOW_DISC = 46;
// The login screen's breathing: 0.09 rad every 40 ms, a cycle of about 2.8 s.
const PULSE_MS = 40;
const PULSE_STEP = 0.09;

function rgba(c, alpha) {
    return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

function report(where, e) {
    global.logError(`greeter-fprint-polkit: ${where}: ${e}`);
}

function titleLabel(dialog) {
    for (const child of dialog.contentLayout.get_children()) {
        if (child._title)
            return child._title;
    }
    return null;
}

function paintLogo(dialog, c, glow) {
    dialog._gfpIcon.set_style(`color: ${rgba(c, 1)};`);
    dialog._gfpLogo.set_style(`width: ${GLOW_DISC}px; height: ${GLOW_DISC}px;`
                              + " background-gradient-direction: radial;"
                              + ` background-gradient-start: ${rgba(c, glow)};`
                              + ` background-gradient-end: ${rgba(c, 0)};`);
}

function logoIcon() {
    if (GLib.file_test(LOGO_FILE, GLib.FileTest.EXISTS))
        return Gio.FileIcon.new(Gio.File.new_for_path(LOGO_FILE));
    return Gio.ThemedIcon.new(LOGO_FALLBACK);
}

function stopPulse(dialog) {
    if (dialog._gfpPulseId) {
        GLib.source_remove(dialog._gfpPulseId);
        dialog._gfpPulseId = 0;
    }
}

function startPulse(dialog) {
    if (dialog._gfpPulseId)
        return;
    dialog._gfpPhase = 0;
    dialog._gfpPulseId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, PULSE_MS, () => {
        try {
            if (!dialog._gfpLogo) {
                dialog._gfpPulseId = 0;
                return GLib.SOURCE_REMOVE;
            }
            dialog._gfpPhase = (dialog._gfpPhase + PULSE_STEP) % (2 * Math.PI);
            const glow = 0.5 + 0.3 * Math.sin(dialog._gfpPhase);
            paintLogo(dialog, COLOURS.waiting, glow);
            return GLib.SOURCE_CONTINUE;
        } catch (e) {
            report("pulse", e);
            dialog._gfpPulseId = 0;
            return GLib.SOURCE_REMOVE;
        }
    });
}

// Swaps the button's label for the logo. The button itself stays: the dialog
// refers to it throughout, and its behaviour does not change - it was not
// reactive before and is not now.
function showLogo(dialog) {
    const button = dialog._okButton;
    if (!button || dialog._gfpLogo)
        return;
    // Kept as the object itself: put back later, it is exactly what Cinnamon
    // created, styling included. (Cinnamon's St.Button labels are ClutterText.)
    dialog._gfpButtonChild = button.get_child();
    dialog._gfpButtonLabel = button.label;
    const icon = new St.Icon({
        gicon: logoIcon(),
        icon_type: St.IconType.SYMBOLIC,
        icon_size: LOGO_SIZE,
    });
    const logo = new St.Bin({ child: icon });
    logo.connect("destroy", () => {
        if (dialog._gfpLogo === logo) {
            stopPulse(dialog);
            dialog._gfpLogo = null;
            dialog._gfpIcon = null;
        }
    });
    dialog._gfpIcon = icon;
    button.set_child(logo);
    // No button face: a framed logo would look like something to press.
    button.set_style("background-color: transparent; background-image: none;"
                     + " border: none; box-shadow: none;");
    dialog._gfpLogo = logo;
}

// Puts the button back: its original label object, or - should that be gone -
// a fresh one from the saved text.
function showButton(dialog) {
    const button = dialog._okButton;
    if (!button || !dialog._gfpLogo)
        return;
    stopPulse(dialog);
    dialog._gfpLogo = null;
    dialog._gfpIcon = null;
    button.set_style(null);
    const original = dialog._gfpButtonChild;
    dialog._gfpButtonChild = null;
    if (original)
        button.set_child(original);
    else
        button.label = dialog._gfpButtonLabel;
}

// The title keeps its white text and gains a coloured glow, like the selected
// name on the login screen; the message takes the colour itself, like the
// message under Tux, with a softer glow of its own; the logo glows like the one
// Tux holds, breathing while the reader waits.
function paint(dialog, state, label) {
    const title = titleLabel(dialog);
    if (!state) {
        stopPulse(dialog);
        if (title)
            title.set_style(null);
        for (const l of [dialog._infoMessageLabel, dialog._errorMessageLabel])
            l.set_style(null);
        return;
    }
    const c = COLOURS[state];
    if (title)
        title.set_style(`text-shadow: 0px 0px 14px ${rgba(c, 0.9)};`);
    if (label)
        label.set_style(`color: ${rgba(c, 1)}; text-shadow: 0px 0px 8px ${rgba(c, 0.6)};`);
    // Last, and on its own: whatever the logo does, the title and the message
    // have their colours already.
    if (dialog._gfpLogo) {
        try {
            if (state === "waiting") {
                paintLogo(dialog, c, 0.6);
                startPulse(dialog);
            } else {
                stopPulse(dialog);
                paintLogo(dialog, c, 0.85);
            }
        } catch (e) {
            report("logo", e);
        }
    }
}

function flashing(dialog) {
    return dialog._gfpRedUntil && GLib.get_monotonic_time() < dialog._gfpRedUntil;
}

// Applies a reader message the original has already put on screen.
function restyle(dialog, text, label) {
    const result = Messages.classify(text);
    if (!result)
        return;
    dialog._gfpFingerprint = true;
    label.set_text(result.text);
    if (result.kind !== Messages.WAITING)
        dialog._gfpRedUntil = GLib.get_monotonic_time() + FLASH_MS * 1000;
    // The logo is a nicety; if it cannot be made, the colours still come.
    try {
        showLogo(dialog);
    } catch (e) {
        report("showLogo", e);
    }
    paint(dialog, result.kind === Messages.WAITING ? "waiting" : "failure", label);
}

function enable() {
    const proto = PolkitAgent.AuthenticationDialog.prototype;
    originals = {
        performAuthentication: proto.performAuthentication,
        _onSessionShowInfo: proto._onSessionShowInfo,
        _onSessionShowError: proto._onSessionShowError,
        _onSessionRequest: proto._onSessionRequest,
        _onSessionCompleted: proto._onSessionCompleted,
    };

    proto.performAuthentication = function (...args) {
        try {
            this._gfpFingerprint = false;
            this._gfpPrompted = false;
            this._gfpPendingInfo = null;
            // A new attempt starts clean; the logo returns with the reader's
            // first message.
            showButton(this);
            paint(this, null, null);
        } catch (e) {
            report("performAuthentication", e);
        }
        return originals.performAuthentication.apply(this, args);
    };

    proto._onSessionShowInfo = function (session, text) {
        // The red holds for its full 1.5 s, as on the login screen: pam_fprintd
        // sends "Failed to match fingerprint" and the next "Place your finger"
        // in the same breath, and without this the red was never seen. Only the
        // display waits; the original runs unchanged when the flash is over.
        try {
            if (flashing(this)) {
                const result = Messages.classify(text);
                if (result && result.kind === Messages.WAITING) {
                    const first = this._gfpPendingInfo === null;
                    this._gfpPendingInfo = text;
                    if (first) {
                        const wait = Math.max(0, (this._gfpRedUntil - GLib.get_monotonic_time()) / 1000);
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.ceil(wait), () => {
                            const pending = this._gfpPendingInfo;
                            this._gfpPendingInfo = null;
                            if (pending !== null && !this._completed && !this._doneEmitted)
                                this._onSessionShowInfo(session, pending);
                            return GLib.SOURCE_REMOVE;
                        });
                    }
                    return;
                }
            }
        } catch (e) {
            report("_onSessionShowInfo (queue)", e);
        }
        originals._onSessionShowInfo.call(this, session, text);
        try {
            restyle(this, text, this._infoMessageLabel);
        } catch (e) {
            report("_onSessionShowInfo", e);
        }
    };

    proto._onSessionShowError = function (session, text) {
        originals._onSessionShowError.call(this, session, text);
        try {
            restyle(this, text, this._errorMessageLabel);
        } catch (e) {
            report("_onSessionShowError", e);
        }
    };

    proto._onSessionRequest = function (...args) {
        originals._onSessionRequest.apply(this, args);
        try {
            // A prompt after the reader has been talking: pam_fprintd has given
            // up and the password is next. Neutral, like the sign on the login
            // screen - no glow asking for a finger that is no longer wanted.
            if (this._gfpFingerprint) {
                this._gfpPrompted = true;
                paint(this, null, null);
                showButton(this);
            }
        } catch (e) {
            report("_onSessionRequest", e);
        }
    };

    proto._onSessionCompleted = function (session, gained) {
        try {
            if (gained && this._gfpFingerprint && !this._completed && !this._doneEmitted) {
                // Green first, close when it has been seen - the login and lock
                // screens do the same. Authorisation is already decided; only
                // the dialog's closing waits, and the original guards itself
                // against running after the dialog was dismissed.
                const label = this._infoMessageLabel;
                label.set_text(this._gfpPrompted ? Messages._("Password accepted")
                                                 : Messages._("Fingerprint recognised"));
                label.show();
                this._errorMessageLabel.hide();
                this._nullMessageLabel.hide();
                paint(this, "success", label);
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, FLASH_MS, () => {
                    originals._onSessionCompleted.call(this, session, gained);
                    return GLib.SOURCE_REMOVE;
                });
                return;
            }
        } catch (e) {
            report("_onSessionCompleted", e);
        }
        originals._onSessionCompleted.call(this, session, gained);
    };
}

function disable() {
    if (!originals)
        return;
    const proto = PolkitAgent.AuthenticationDialog.prototype;
    for (const [name, fn] of Object.entries(originals))
        proto[name] = fn;
    originals = null;
}

function init(meta) {
    imports.searchPath.unshift(meta.path);
    Messages = imports.greeterFprintMessages;
}
