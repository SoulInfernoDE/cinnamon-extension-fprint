# cinnamon-extension-fprint

*[English](README.md) · **Deutsch***

Fingerabdruck-Farben für Cinnamons Legitimierungsdialog – den, den `pkexec`,
Software-Installationen und alles andere zeigen, was polkit um Erlaubnis fragt.

Eine Cinnamon-Erweiterung aus der Familie von
[greeter-fprint](https://github.com/SoulInfernoDE/greeter-fprint). Inoffiziell:
nicht mit Linux Mint verbunden und weder von Linux Mint unterstützt noch
empfohlen.

## Warum

Der normale Dialog zeigt die Meldungen des Lesers als schlichten Text, auf
Englisch, und gibt kein Zeichen, ob ein Finger angenommen oder abgelehnt wurde.
Diese Erweiterung gibt ihm die Zustände des greeter-fprint-Anmeldebildschirms:

| | |
| --- | --- |
| **Gelb** | der Leser wartet |
| **Rot** | Finger nicht erkannt – hält 1,5 s |
| **Grün** | angenommen – der Dialog schließt nach 1,5 s |
| **Kein Leuchten** | der Leser hat aufgegeben; gib dein Passwort ein |

Der Titel leuchtet in der Farbe des Zustands, und die Meldung des Lesers nimmt
diese Farbe an und ist übersetzt: Deutsch ist vollständig, andere Sprachen
fallen auf Englisch zurück.

## Voraussetzungen

- Cinnamon 6.x
- [greeter-fprint](https://github.com/SoulInfernoDE/greeter-fprint) installiert –
  die Meldungen kommen aus seinem Übersetzungskatalog; ohne ihn erscheinen sie
  auf Englisch. Seine Töne für die Sitzung spielen auch bei diesem Dialog.

## Installation

```bash
git clone https://github.com/SoulInfernoDE/cinnamon-extension-fprint.git
cd cinnamon-extension-fprint
meson setup build --prefix=/usr
ninja -C build
sudo ninja -C build install
```

Danach unter **Systemeinstellungen → Erweiterungen** als „Fingerabdruck im
Legitimierungsdialog“ einschalten.

Ohne root: `greeter-fprint-polkit@soulinferno/` nach
`~/.local/share/cinnamon/extensions/` kopieren; nur ihr Name in der Liste der
Erweiterungen bleibt dann englisch.

## Wie es funktioniert

| | |
| --- | --- |
| [`docs/HOW-IT-WORKS.de.md`](docs/HOW-IT-WORKS.de.md) | wie der Dialog erweitert wird, warum das Rot stehen bleibt und warum nichts hier das Ergebnis einer Anmeldung ändern kann |

Auch auf Englisch verfügbar; der Link steht oben.

## Verwandt

- [greeter-fprint](https://github.com/SoulInfernoDE/greeter-fprint) – dieselben
  Zustände am LightDM-Anmeldebildschirm, und Fingerabdruck-Töne für die Sitzung
- [screensaver-fprint](https://github.com/SoulInfernoDE/screensaver-fprint) –
  dasselbe für den Cinnamon-Sperrbildschirm

## Für Linux Mint

Alles in diesem Repository darf Linux Mint frei verwenden, anpassen und neu
lizenzieren – ohne zu fragen und ohne Namensnennung.

## Lizenz

GPL-3 – siehe [COPYING](COPYING).
