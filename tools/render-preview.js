// Renders the README preview inside the running Cinnamon: a real
// AuthenticationDialog - Cinnamon's own class, with this extension patching it -
// that belongs to no authentication. The same methods pam_fprintd's messages
// reach are called on it in the order of the login screen's animation, and each
// state is captured with Cinnamon's own screenshot function, losslessly.
// Only the order is scripted; every pixel is the real dialog's.
//
// __OUT__ is the output directory, __LANG__ is "de" or "en". For "en",
// LC_MESSAGES is set to C for the few seconds of the run - a plain LANGUAGE
// change is not picked up, gettext caches until setlocale() - and restored after.
// Run through tools/cinnamon-eval.py, not gdbus: gdbus reads arguments that
// start with "(" as GVariant text and mangles the code.
(function () {
try {
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const Cinnamon = imports.gi.Cinnamon;
const Main = imports.ui.main;
const PolkitAgent = imports.ui.polkitAuthenticationAgent;
const OUT = '__OUT__';
const LANG = '__LANG__';
const MESSAGES = Gettext.LocaleCategory.MESSAGES;
const prevLocale = Gettext.setlocale(MESSAGES, null);
const log = [];
let dialog = null;
let done = false;
GLib.mkdir_with_parents(OUT, 0o755);
if (LANG === 'en')
    Gettext.setlocale(MESSAGES, 'C.UTF-8');
const mon = Main.layoutManager.primaryMonitor;
const DESC = "Authentication is needed to run `/usr/bin/true' as the super user";

function newDialog() {
    return new PolkitAgent.AuthenticationDialog('org.freedesktop.policykit.exec', DESC, 'gfp-preview', [GLib.get_user_name()]);
}
function shot(name) {
    const [x, y] = dialog.dialogLayout.get_transformed_position();
    const [w, h] = dialog.dialogLayout.get_transformed_size();
    log.push(`${name} ${Math.round(x - mon.x)} ${Math.round(y - mon.y)} ${Math.round(w)} ${Math.round(h)}`);
    new Cinnamon.Screenshot().screenshot_area(false, mon.x, mon.y, mon.width, mon.height, `${OUT}/${name}.png`, () => {});
}
function closeDialog() {
    const d = dialog;
    dialog = null;
    if (!d)
        return;
    try { d.close(global.get_current_time()); } catch (e) { log.push('close ' + e); }
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => { try { d.destroy(); } catch (e) {} return false; });
}
function finish() {
    if (done)
        return;
    done = true;
    closeDialog();
    if (LANG === 'en')
        Gettext.setlocale(MESSAGES, prevLocale);
    log.push('locale ' + Gettext.setlocale(MESSAGES, null));
    GLib.file_set_contents(`${OUT}/log.txt`, log.join('\n') + '\n');
}
const steps = [
    [300,  () => { dialog = newDialog(); dialog._onSessionShowInfo(null, 'Place your finger on the fingerprint reader'); }],
    [1000, () => shot('1-waiting')],
    [1500, () => dialog._onSessionShowError(null, 'Failed to match fingerprint')],
    [1900, () => shot('2-failed')],
    [3300, () => dialog._onSessionShowInfo(null, 'Place your finger on the fingerprint reader')],
    [3600, () => dialog._onSessionCompleted(null, true)],
    [3900, () => shot('3-success')],
    [5300, () => closeDialog()],
    [5900, () => { dialog = newDialog(); dialog._onSessionShowInfo(null, 'Place your finger on the fingerprint reader'); }],
    [6400, () => dialog._onSessionRequest(null, 'Password: ', false)],
    [6900, () => shot('4-password')],
    [7300, () => finish()],
    [11000, () => finish()],
];
for (const [ms, fn] of steps) {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        try { fn(); } catch (e) { log.push(`step ${ms}: ${e}`); }
        return false;
    });
}
return 'started ' + LANG + ' on monitor ' + mon.width + 'x' + mon.height;
} catch (e) {
return 'ERR ' + e + ' @ ' + e.stack;
}
})()
