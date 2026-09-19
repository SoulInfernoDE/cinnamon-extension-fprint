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

const GLib = imports.gi.GLib;
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

// The title keeps its white text and gains a coloured glow, like the selected
// name on the login screen; the message takes the colour itself, like the
// message under Tux, with a softer glow of its own.
function paint(dialog, state, label) {
    const title = titleLabel(dialog);
    if (!state) {
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
    if (result.kind === Messages.WAITING) {
        paint(dialog, "waiting", label);
    } else {
        paint(dialog, "failure", label);
        dialog._gfpRedUntil = GLib.get_monotonic_time() + FLASH_MS * 1000;
    }
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
