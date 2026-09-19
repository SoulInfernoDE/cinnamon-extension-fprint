#!/usr/bin/python3
"""Runs a JavaScript file inside the running Cinnamon through org.Cinnamon.Eval.

The code goes over D-Bus as a real string. gdbus would try to read an argument
that starts with "(" as GVariant text first, and pass a mangled one on.

usage: cinnamon-eval.py FILE [PLACEHOLDER VALUE]... [--parse-only]
"""
import json
import sys

from gi.repository import Gio, GLib

args = [a for a in sys.argv[1:] if a != "--parse-only"]
code = open(args[0], encoding="utf-8").read()
for old, new in zip(args[1::2], args[2::2]):
    code = code.replace(old, new)
if "--parse-only" in sys.argv:
    code = ("(function () { try { new Function(" + json.dumps(code) + "); return 'PARSE OK'; }"
            " catch (e) { return 'ERR ' + e.name + ': ' + e.message + ' (line ' + e.lineNumber + ')'; } })()")
bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
ok, result = bus.call_sync("org.Cinnamon", "/org/Cinnamon", "org.Cinnamon", "Eval",
                           GLib.Variant("(s)", (code,)), None, Gio.DBusCallFlags.NONE,
                           10000, None).unpack()
print(result)
sys.exit(0 if ok else 1)
