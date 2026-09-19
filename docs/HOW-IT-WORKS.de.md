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
| `_onSessionRequest` | eine Passwortabfrage: das Leuchten geht aus, der Knopf kommt zurück |
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

## Das Logo im Knopf

Solange der Leser zuständig ist, hat der Knopf „Authentifizieren“ nichts zu tun.
Er sendet nur den Text des Passwortfelds – `_onEntryActivate()` kehrt sofort
zurück, wenn es leer ist –, und der Dialog legt ihn nicht anklickbar an, bis
etwas getippt wird. Deshalb wird seine Beschriftung gegen das Mint-Logo getauscht
und seine Knopffläche durchsichtig gemacht: Ein eingerahmtes Logo sähe aus wie
etwas zum Drücken.

Der Knopf selbst bleibt, wo er ist. Der Dialog spricht ihn überall an, und ihn zu
entfernen, wäre eine Änderung am Dialog; seinen Inhalt zu tauschen, ist keine.
Bei einer Passwortabfrage bekommt der Knopf seine ursprüngliche Beschriftung
zurück – genau das Objekt, das Cinnamon angelegt hat und das beiseitegelegt wurde,
solange das Logo zu sehen war –, und jeder neue Versuch beginnt mit dem Knopf,
bis die erste Meldung des Lesers eintrifft.

Das Logo atmet, solange der Leser wartet – 0,09 rad alle 40 ms, der Rhythmus des
Anmeldebildschirms – und leuchtet sonst ruhig rot oder grün. Das Leuchten ist ein
radialer Verlauf auf einer Scheibe hinter dem Symbol: in der Mitte die Farbe des
Zustands, zum Rand hin durchsichtig – das Licht, das der Anmeldebildschirm hinter
das Logo zeichnet. Ein Hintergrund wird immer gezeichnet; ein box-shadow auf einer
Scheibe ohne Hintergrund wurde es nicht, weshalb der erste Versuch kein Leuchten
zeigte und damit auch nichts, das atmen konnte.

Das Symbol wird über seinen Pfad geladen, wie greeter-fprint es tut:
`/usr/share/icons/hicolor/scalable/apps/linuxmint-logo-badge-symbolic.svg`, als
`Gio.FileIcon`, das einfärbbar bleibt, weil die Datei ein `-symbolic.svg` ist. Über
den Namen nachgeschlagen, landete Cinnamons `St.Icon` beim Ersatz, obwohl GTK das
Logo findet, und eine eigene Eigenschaft für einen Ersatz hat es nicht. Fehlt die
Datei, nimmt `auth-fingerprint-symbolic` ihren Platz ein. Von Linux Mint wird nichts
mitgeliefert.

## Farben

Übernommen aus der Fingerabdruck-Anzeige von greeter-fprint, damit Dialog,
Anmeldebildschirm und Sperrbildschirm zusammenpassen: Gelb `#ffcc1a`, Rot
`#e63836`, Grün `#3db857`. Der Titel behält seine weiße Schrift und bekommt ein
Leuchten, wie der gewählte Name am Anmeldebildschirm; die Meldung nimmt die
Farbe selbst an, wie die Meldung unter Tux.

## Die Vorschau rendern

`docs/states.gif` und `docs/states.de.gif` werden im laufenden Cinnamon
gerendert, nicht vom Bildschirm abgefilmt. `tools/render-preview.js` erzeugt einen
echten `AuthenticationDialog` – Cinnamons eigene Klasse, von der Erweiterung
ergänzt –, der zu keiner Anmeldung gehört, ruft darauf die Methoden auf, die sonst
die Meldungen von pam_fprintd erreichen, in der Reihenfolge der
greeter-fprint-Animation, und nimmt jeden Zustand mit Cinnamons eigener
Screenshot-Funktion auf.

```bash
python3 tools/cinnamon-eval.py tools/render-preview.js __OUT__ /tmp/preview/de __LANG__ de
python3 tools/cinnamon-eval.py tools/render-preview.js __OUT__ /tmp/preview/en __LANG__ en
python3 tools/make-preview-gif.py /tmp/preview
```

Jeder Lauf zeigt den Dialog etwa acht Sekunden lang. Für Englisch stellt er für
diese Sekunden `LC_MESSAGES` auf `C` und danach zurück: Nur `LANGUAGE` zu ändern,
greift nicht, weil gettext Übersetzungen zwischenspeichert, bis `setlocale()`
aufgerufen wird. `tools/cinnamon-eval.py` übergibt den Code als echten
D-Bus-String, weil `gdbus call` ein Argument, das mit „(“ beginnt, als GVariant-Text
liest und verstümmelt weitergibt.

Die Aufnahmen sind Bildschirmfotos des ganzen Monitors und enthalten deshalb auch,
was hinter dem Dialog lag. `make-preview-gif.py` macht alles außerhalb der
abgerundeten Form des Dialogs durchsichtig: Nichts vom Bildschirm gelangt in die
README, und die Animation sitzt auf hellen wie dunklen Seiten sauber.
