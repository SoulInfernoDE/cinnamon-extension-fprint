# Wie es funktioniert

*[English](HOW-IT-WORKS.md) · **Deutsch***

## Den Dialog zur Laufzeit erweitern

Cinnamons Legitimierungsdialog ist JavaScript im Cinnamon-Prozess:
`AuthenticationDialog` in `/usr/share/cinnamon/js/ui/polkitAuthenticationAgent.js`.
Diese Datei zu ändern, würde bis zum nächsten Cinnamon-Update halten. Die
Erweiterung ersetzt stattdessen beim Einschalten fünf Methoden des Dialogs und
setzt beim Ausschalten die Originale wieder ein:

| Methode | Was die Erweiterung ergänzt |
| --- | --- |
| `performAuthentication` | setzt ihren eigenen Zustand für jeden neuen Versuch zurück |
| `_onSessionShowInfo` | erkennt die Meldung des Lesers, übersetzt und färbt sie |
| `_onSessionShowError` | dasselbe für Fehlermeldungen |
| `_onSessionRequest` | eine Passwortabfrage: das Leuchten geht aus |
| `_onSessionCompleted` | ein Erfolg wird 1,5 s grün gezeigt, bevor der Dialog schließt |

Jede ersetzte Methode ruft das Original auf, und jede Ergänzung ist abgesichert.
Das ist ein Anmeldedialog: Eine Farbe, die sich nicht ändert, ist ein
Schönheitsfehler, ein Dialog, der abstürzt, nicht. Fehler landen in
`~/.xsession-errors` mit dem Präfix `greeter-fprint-polkit:`, und der Dialog macht
weiter, als gäbe es die Erweiterung nicht.

## Hier wird nichts entschieden

Ob die Anmeldung gelingt, entscheiden PAM und polkit, bevor irgendetwas hiervon
läuft. Die Erweiterung ändert nur, wie und wann das Ergebnis *angezeigt* wird.
Meldet `_onSessionCompleted` einen Erfolg, ist die Berechtigung bereits erteilt;
die Erweiterung zeigt das Grün und ruft das Original 1,5 s später auf. Wird der
Dialog in der Zwischenzeit geschlossen, merkt das Original, dass es schon fertig
ist, und tut nichts.

## Das Rot bleibt stehen

`pam_fprintd` schickt „Failed to match fingerprint“ und direkt danach das
nächste „Place your finger on the reader“. So angezeigt, wie sie kommen, wäre das
Rot nie zu sehen. Eine Wartemeldung, die während des Rots eintrifft, wird deshalb
zurückgehalten, bis die 1,5 s um sind, und erst dann unverändert an die
Originalmethode übergeben.

## Meldungen

PAM-Meldungen tragen keine Kennung, woher sie stammen; die des Lesers werden
deshalb an ihrem Text erkannt. Der Helfer von polkit liefert sie auf Englisch;
deutsche Muster werden ebenfalls erkannt, falls ein übersetztes fprintd sie
schickt. Angezeigt wird, was der Übersetzungskatalog von greeter-fprint liefert,
mit Englisch als Basis und Rückfall. Der Klassifizierer ist derselbe, den
greeter-fprint und screensaver-fprint verwenden, in seiner dritten Sprache.

Nach einer Passwortabfrage hat der Leser bereits aufgegeben; ein Erfolg heißt
dann „Passwort akzeptiert“ statt „Fingerabdruck erkannt“.

## Was bleibt, wie es ist

Die Zeile unter dem Titel – „Authentication is needed to run … as the super
user“ – kommt von polkit, schon übersetzt oder eben nicht und mit bereits
eingesetztem Programmpfad. Einen sauberen Weg, sie nachträglich zu übersetzen,
gibt es nicht; die Erweiterung lässt sie in Ruhe.

## Farben

Übernommen aus der Fingerabdruck-Anzeige von greeter-fprint, damit Dialog,
Anmeldebildschirm und Sperrbildschirm zusammenpassen: Gelb `#ffcc1a`, Rot
`#e63836`, Grün `#3db857`. Der Titel behält seine weiße Schrift und bekommt ein
Leuchten, wie der gewählte Name am Anmeldebildschirm; die Meldung nimmt die
Farbe selbst an, wie die Meldung unter Tux.
