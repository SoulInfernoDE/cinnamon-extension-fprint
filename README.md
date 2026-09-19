# cinnamon-extension-fprint

***English** · [Deutsch](README.de.md)*

Fingerprint colours for Cinnamon's authentication dialog — the one `pkexec`,
software installs and anything else that asks polkit for permission put on
screen.

A Cinnamon extension from the family of
[greeter-fprint](https://github.com/SoulInfernoDE/greeter-fprint). Unofficial:
not affiliated with, endorsed by, or supported by Linux Mint.

![Cinnamon's authentication dialog with the extension: title and message glow
yellow and the Mint logo breathes while the reader waits, red for a rejected
finger, green when accepted; at the password prompt the Authenticate button is
back](docs/states.gif)

Cinnamon's own dialog with the extension, rendered inside the running Cinnamon:
only the order of the states is scripted, each held for the duration the code
gives it. How it is made:
[`docs/HOW-IT-WORKS.md`](docs/HOW-IT-WORKS.md#rendering-the-preview).

## Why

The stock dialog shows the reader's messages as plain text, in English, and
gives no sign whether a finger was accepted or rejected. This extension gives it
the states of greeter-fprint's login screen:

| | |
| --- | --- |
| **Yellow** | the reader is waiting |
| **Red** | finger not recognised — holds for 1.5 s |
| **Green** | accepted — the dialog closes after 1.5 s |
| **No glow** | the reader gave up; type your password |

The title glows in the state's colour, and the reader's message takes that
colour and is translated: German is complete, other languages fall back to
English. While the reader is in charge, the "Authenticate" button - which has
nothing to send until a password is asked for - shows the Mint logo instead,
glowing and breathing like the one Tux holds on the login screen; it turns back
into the button at the password prompt.

## Requirements

- Cinnamon 6.x
- [greeter-fprint](https://github.com/SoulInfernoDE/greeter-fprint) installed —
  the messages come from its translation catalogue; without it they appear in
  English. Its session sounds also play for this dialog.

## Install

```bash
git clone https://github.com/SoulInfernoDE/cinnamon-extension-fprint.git
cd cinnamon-extension-fprint
meson setup build --prefix=/usr
ninja -C build
sudo ninja -C build install
```

Then switch it on under **System Settings → Extensions** as "Fingerprint
authentication dialog".

Without root, copy `greeter-fprint-polkit@soulinferno/` to
`~/.local/share/cinnamon/extensions/`; only its name in the Extensions list
then stays English.

## How it works

| | |
| --- | --- |
| [`docs/HOW-IT-WORKS.md`](docs/HOW-IT-WORKS.md) | how the dialog is extended, why the red holds, and why nothing here can change the outcome of an authentication |

Also available in German; the link sits at the top.

## Related

- [greeter-fprint](https://github.com/SoulInfernoDE/greeter-fprint) — the same
  states on the LightDM login screen, and fingerprint sounds for the session
- [screensaver-fprint](https://github.com/SoulInfernoDE/screensaver-fprint) —
  the same for the Cinnamon lock screen

## For Linux Mint

Everything in this repository may be used, adapted and relicensed by Linux Mint
freely, without asking and without attribution.

## License

GPL-3 — see [COPYING](COPYING). The Linux Mint logo is not in this repository:
the extension shows the system's installed icon, and a generic fingerprint icon
where that is missing.
