// Copyright (C) 2026 soul-inferno <nofunction@gmx.net>
//
// This file is part of cinnamon-extension-fprint, from the greeter-fprint family, and is
// licensed under the GNU General Public License version 3. See COPYING.

// Classification of pam_fprintd's messages for Cinnamon's authentication
// dialog. The third copy of the same rules, after greeter-fprint's src/fingerprint-messages.vala
// (login screen) and screensaver-fprint's fingerprintMessages.py (lock screen):
// PAM messages carry no marker saying where they came from, so recognising the
// text is the only way to tell the reader's from any other. They are matched in
// English - what polkit's helper actually delivers here - and in German, in case
// a translated fprintd sends them. Only matching knows German; everything shown
// comes from greeter-fprint's catalogue, with English as base and fallback.

const Gettext = imports.gettext;

const DOMAIN = "greeter-fprint";
Gettext.bindtextdomain(DOMAIN, "/usr/share/locale");

function _(text) {
    return Gettext.dgettext(DOMAIN, text);
}

var WAITING = "waiting";
var RETRY = "retry";
var FAILURE = "failure";

// Longest first: "left index finger" has to win over a bare "finger".
// English as pam_fprintd sends it, German as an installed fprintd translation
// would - for recognising only. The name shown comes from fingerLabel().
const FINGERS = [
    ["left index finger", "linken zeigefinger"],
    ["left middle finger", "linken mittelfinger"],
    ["left ring finger", "linken ringfinger"],
    ["left little finger", "linken kleinen finger"],
    ["right index finger", "rechten zeigefinger"],
    ["right middle finger", "rechten mittelfinger"],
    ["right ring finger", "rechten ringfinger"],
    ["right little finger", "rechten kleinen finger"],
    ["left thumb", "linken daumen"],
    ["right thumb", "rechten daumen"],
];

// One literal per finger, so xgettext finds every msgid.
function fingerLabel(finger) {
    switch (finger) {
    case "left index finger": return _("left index finger");
    case "left middle finger": return _("left middle finger");
    case "left ring finger": return _("left ring finger");
    case "left little finger": return _("left little finger");
    case "right index finger": return _("right index finger");
    case "right middle finger": return _("right middle finger");
    case "right ring finger": return _("right ring finger");
    case "right little finger": return _("right little finger");
    case "left thumb": return _("left thumb");
    case "right thumb": return _("right thumb");
    default: return finger;
    }
}

// Returns {kind, text} for a message from the reader, or null for anything else.
function classify(raw) {
    if (!raw)
        return null;
    const text = raw.toLowerCase();
    const has = (s) => text.includes(s);

    if (has("failed to match") || has("no match") || has("nicht erkannt"))
        return { kind: FAILURE, text: _("Fingerprint not recognised") };
    if ((has("timed out") || has("zeitüberschreitung")) &&
        (has("verification") || has("finger") || has("leser")))
        return { kind: FAILURE, text: _("The reader timed out") };
    if (has("no prints enrolled"))
        return { kind: FAILURE, text: _("No fingerprint enrolled") };

    if (has("too short") || has("zu schnell"))
        return { kind: RETRY, text: _("Swiped too fast - once more, please") };
    if (has("not centered") || has("not centred") || has("nicht mittig"))
        return { kind: RETRY, text: _("Not centred - once more, please") };
    if (has("remove your finger") || has("finger weg"))
        return { kind: RETRY, text: _("Lift your finger and try again") };
    if ((has("place your finger") || has("swipe your finger")) && has("again"))
        return { kind: RETRY, text: _("Once more, please") };
    if (has("erneut") && (has("finger") || has("leser")))
        return { kind: RETRY, text: _("Once more, please") };

    const placing = has("place your") || has("legen sie");
    const swiping = has("swipe your") || has("ziehen sie");
    if (placing || swiping) {
        for (const [english, german] of FINGERS) {
            if (has(english) || has(german)) {
                const label = fingerLabel(english);
                return { kind: WAITING,
                         text: (placing ? _("Place your %s on the reader")
                                        : _("Swipe your %s across the reader")).replace("%s", label) };
            }
        }
        return { kind: WAITING,
                 text: placing ? _("Place your finger on the reader")
                               : _("Swipe your finger across the reader") };
    }

    if (has("fingerprint") || has("fingerabdruck"))
        return { kind: WAITING, text: _("Waiting for the fingerprint reader") };

    return null;
}
