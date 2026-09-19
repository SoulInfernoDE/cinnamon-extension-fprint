# How it works

***English** · [Deutsch](HOW-IT-WORKS.de.md)*

## Extending the dialog at runtime

Cinnamon's authentication dialog is JavaScript inside the Cinnamon process:
`AuthenticationDialog` in `/usr/share/cinnamon/js/ui/polkitAuthenticationAgent.js`.
Editing that file would work until the next Cinnamon update. The extension
instead replaces five of the dialog's methods when it is switched on, and puts
the originals back when it is switched off:

| Method | What the extension adds |
| --- | --- |
| `performAuthentication` | resets its own state for each new attempt |
| `_onSessionShowInfo` | classifies the reader's message, translates and colours it |
| `_onSessionShowError` | the same for error messages |
| `_onSessionRequest` | a password prompt: the glow goes out, the button returns |
| `_onSessionCompleted` | a success is shown green for 1.5 s before the dialog closes |

Every replaced method calls the original, and every addition is guarded. This
is an authentication dialog: a colour that fails to change is cosmetic, a dialog
that throws is not. Errors are logged to `~/.xsession-errors`, prefixed with
`greeter-fprint-polkit:`, and the dialog carries on as if the extension were not
there.

## Nothing here decides anything

Whether authentication succeeds is settled by PAM and polkit before any of this
runs. The extension only changes how and when the result is *shown*. When
`_onSessionCompleted` reports success, authorisation is already granted; the
extension shows the green and calls the original 1.5 s later. If the dialog is
dismissed in the meantime, the original notices that it has already finished
and does nothing.

## The red holds

`pam_fprintd` sends "Failed to match fingerprint" and, in the same breath, the
next "Place your finger on the reader". Shown as they come, the red would never
be seen. So a waiting message that arrives during the red is held back until
the 1.5 s are over, and only then handed to the original method, unchanged.

## Messages

PAM messages carry no marker saying where they came from, so the reader's are
recognised by their text. polkit's helper delivers them in English; German
patterns are recognised too, in case a translated fprintd sends them. What is
shown comes from greeter-fprint's translation catalogue, with English as the
base and fallback. The classifier is the same one greeter-fprint and
screensaver-fprint use, in its third language.

After a password prompt the reader has already given up, so a success then says
"Password accepted" rather than "Fingerprint recognised".

## What stays as it is

The line under the title — "Authentication is needed to run … as the super
user" — comes from polkit, already translated or not and with the program's
path already filled in. There is no clean way to translate it afterwards, so
the extension leaves it alone.

## The logo in the button

While the reader is in charge, the "Authenticate" button has nothing to do. It
only ever sends the password entry's text - `_onEntryActivate()` returns at once
when that is empty - and the dialog creates it unreactive until something is
typed. So its label is swapped for the Mint logo, and its button face made
transparent: a framed logo would look like something to press.

The button itself stays where it is. The dialog refers to it throughout, and
removing it would be a change to the dialog; swapping its content is not. At a
password prompt the button gets its original label back - the very object
Cinnamon created, kept aside while the logo was showing - and each new attempt
starts from the button until the reader's first message arrives.

The logo breathes while the reader waits - 0.09 rad every 40 ms, the login
screen's own rhythm - and holds a steady red or green otherwise. The glow is a
radial gradient on a disc behind the icon, the state's colour at the centre
fading to nothing at the edge - the light the login screen draws behind the
logo. A background is always painted; a box-shadow on a disc without one was
not, which is why the first attempt showed no glow and so nothing to breathe.

The icon is loaded by path, the way greeter-fprint loads it:
`/usr/share/icons/hicolor/scalable/apps/linuxmint-logo-badge-symbolic.svg`, as
a `Gio.FileIcon`, which stays tintable because the file is a `-symbolic.svg`.
Looked up by name, Cinnamon's `St.Icon` settled on the fallback even though GTK
finds the logo, and it has no fallback property of its own. Where the file is
missing, `auth-fingerprint-symbolic` takes its place. Nothing of Linux Mint's is
shipped.

## Colours

Taken from greeter-fprint's fingerprint panel, so the dialog, the login screen
and the lock screen match: yellow `#ffcc1a`, red `#e63836`, green `#3db857`. The
title keeps its white text and gains a glow, like the selected name on the login
screen; the message takes the colour itself, like the message under Tux.

## Rendering the preview

`docs/states.gif` and `docs/states.de.gif` are rendered inside the running
Cinnamon, not filmed off the screen. `tools/render-preview.js` creates a real
`AuthenticationDialog` - Cinnamon's own class, with the extension patching it -
that belongs to no authentication, calls on it the methods pam_fprintd's
messages reach, in the order of greeter-fprint's animation, and captures each
state with Cinnamon's own screenshot function.

```bash
python3 tools/cinnamon-eval.py tools/render-preview.js __OUT__ /tmp/preview/de __LANG__ de
python3 tools/cinnamon-eval.py tools/render-preview.js __OUT__ /tmp/preview/en __LANG__ en
python3 tools/make-preview-gif.py /tmp/preview
```

Each run shows the dialog for about eight seconds. For English it sets
`LC_MESSAGES` to `C` for those seconds and restores it afterwards: changing
`LANGUAGE` alone is not picked up, because gettext caches translations until
`setlocale()` is called. `tools/cinnamon-eval.py` passes the code as a real
D-Bus string, because `gdbus call` reads an argument starting with "(" as
GVariant text and hands on a mangled one.

The captures are whole-monitor screenshots, so they also contain whatever was
behind the dialog. `make-preview-gif.py` makes everything outside the dialog's
rounded outline transparent: nothing from the screen reaches the README, and
the animation sits cleanly on light and dark pages alike.
