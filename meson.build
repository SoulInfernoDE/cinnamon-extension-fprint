project('cinnamon-extension-fprint', version: '1.0.0', meson_version: '>= 0.49.0')

i18n = import('i18n')

datadir = get_option('datadir')
extension_uuid = 'greeter-fprint-polkit@soulinferno'

install_data(
    [
        extension_uuid / 'metadata.json',
        extension_uuid / 'extension.js',
        extension_uuid / 'greeterFprintMessages.js',
    ],
    install_dir: datadir / 'cinnamon' / 'extensions' / extension_uuid,
)

# Cinnamon translates an extension's name and description with the uuid as the
# gettext domain, so the extension carries a small catalogue of its own. The
# messages it shows in the dialog come from greeter-fprint's catalogue.
subdir('po')
