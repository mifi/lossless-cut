# Installation and files

## There is no installer

There is no installer. The app is just a compressed file that you download from [GitHub](https://github.com/mifi/lossless-cut/releases) and extract. Then you run the executable contained within.
- Windows: Download the `.7z` file and extract it using [7zip](https://www.7-zip.org/download.html).
- MacOS: Mount the `dmg` and drag the app into your `Applications` folder.
- Linux: Y'all know what to do ;)

## Portable app?

LosslessCut is **not** a portable app. If you install it from the Mac App Store or Microsoft Store, it is somewhat portable because it will be containerized by the operating system, so that when you uninstall the app there will most likely not be many traces of it left. You *can* however customise where settings are stored, see below.

## Settings and temporary files

Settings, logs and temporary cache files are stored in your [`appData`](https://www.electronjs.org/docs/api/app#appgetpathname) folder.

### `appData` folder:

| OS | Path | Notes |
|-|-|-|
| Windows | `%APPDATA%\LosslessCut` | |
| Windows (MS Store Version) | `C:\Users\%USERNAME%\AppData\Local\Packages\57275mifi.no.LosslessCut_eg8x93dt4dxje\LocalCache\Roaming\LosslessCut` | [*Not sure](https://github.com/mifi/lossless-cut/discussions/2167) |
| MacOS | `~/Library/Application Support/LosslessCut` | |
| MacOS (App Store version) | `~/Library/Containers/no.mifi.losslesscut/Data/Library/Application Support/LosslessCut` | |
| Linux | `$XDG_CONFIG_HOME/LosslessCut` or `~/.config/LosslessCut` | |

[What is Windows `%APPDATA%`?](https://superuser.com/questions/632891/what-is-appdata)

Settings and keyboard actions are stored inside the `config.json` file inside your `appData` folder.

### Custom `config.json` path

On Windows, if you create a `config.json` file with the contents `{}` next to the `LosslessCut.exe` file, LosslessCut will read/store settings from this file instead of the one inside `appData`. Note that other temporary files will still be stored in `appData`. Alternatively you can specify a custom path to a folder containing `config.json` by using the [CLI option](./cli.md) `--config-dir`. See also [#645](https://github.com/mifi/lossless-cut/issues/645).

## How to uninstall

Just delete the folder/app that you extracted when you installed it.

If you want to also delete all settings, logs and caches, see [Settings and temporary files](#settings-and-temporary-files) above. See also [#2058](https://github.com/mifi/lossless-cut/issues/).

## Unofficial versions

Because LosslessCut is Open Source (GPL), there are many people and organizations who publish their own variant of LosslessCut for example portableapps.com. This is fine, however **I don't provide support for those versions**.
