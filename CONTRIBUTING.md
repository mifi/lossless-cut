# Contributing

## [Translations / i18n](docs/translation.md)

## Development environment setup

This app is built using Electron.
Make sure you have at least Node v16. The app uses ffmpeg from PATH when developing.

```bash
git clone https://github.com/mifi/lossless-cut.git
cd lossless-cut
yarn
yarn install-electron
```

Note: `yarn` may take some time to complete.

### Installing `ffmpeg`

Run one of the below commands:
```bash
yarn download-ffmpeg-darwin-x64
yarn download-ffmpeg-darwin-arm64
yarn download-ffmpeg-linux-x64
yarn download-ffmpeg-linux-arm64
yarn download-ffmpeg-win32-x64
yarn download-ffmpeg-win32-arm64
```

For Windows, you may have to install [7z](https://www.7-zip.org/download.html), and then put the 7z folder in your `PATH`.

### Run app in development mode

```bash
yarn dev
```

### Run all code checks and tests

Run linting, code style, types, tests etc with the following command:

```bash
yarn check
```

Most of these checks are automatically run in GitHub Actions.

### Other scripts

See [package.json](./package.json) "scripts" section.

### Contributing code

To contribute code, use [pull requests](https://github.com/mifi/lossless-cut/pulls). If you would like to contribute a lot of code, please first create an issue to check the viability of your change - the larger the PR you submit, the less likely that it will be merged.

## `mas-dev` (Mac App Store) local build

This will sign using the development provisioning profile:

```bash
yarn pack-mas-dev
```

MAS builds have some restrictions, see `isMasBuild` variable in code. In particular, any file cannot be read without the user's consent.

NOTE: when MAS (dev) build, Application Support will instead be located here:
```
~/Library/Containers/no.mifi.losslesscut-mac/Data/Library/Application Support
```

### Starting over fresh

```bash
rm -rf ~/Library/Containers/no.mifi.losslesscut-mac
```

## Windows Store notes

Windows store version is built as a Desktop Bridge app (with `runFullTrust` capability). This means the app has access to essentially everything the user has access to, and even `internetClient` is redundant.

- https://learn.microsoft.com/en-us/windows/uwp/packaging/app-capability-declarations
- https://learn.microsoft.com/en-us/archive/blogs/appconsult/a-simpler-and-faster-way-to-publish-your-desktop-bridge-applications-on-the-microsoft-store
- https://stackoverflow.com/a/52921641/6519037

## Releasing

See [RELEASING.md](./RELEASING.md).

## Minimum OS version

See [requirements](docs/requirements.md).

### MacOS [`LSMinimumSystemVersion`](https://developer.apple.com/documentation/bundleresources/information_property_list/lsminimumsystemversion)

How to check the value:

```bash
yarn pack-mas-dev
cat dist/mas-dev-arm64/LosslessCut.app/Contents/Info.plist
```
Look for the key `LSMinimumSystemVersion`.

`LSMinimumSystemVersion` can be overridden in `electron-builder` by [`mac.minimumSystemVersion`](https://www.electron.build/configuration/mac.html)

See also `MACOSX_DEPLOYMENT_TARGET` in [ffmpeg-build-script](https://github.com/mifi/ffmpeg-build-script/blob/master/build-ffmpeg).

Links:
- https://support.google.com/chrome/a/answer/7100626
- https://bignerdranch.com/blog/requiring-a-minimum-version-of-os-x-for-your-application/
- [#1386](https://github.com/mifi/lossless-cut/issues/1386)

## Maintenance chores

### Upgrade FFmpeg

Use the newest stable release branch that all platforms can get (BtbN may lag behind), and keep all platforms on the same branch.

1. macOS: make a new [ffmpeg-build-script](https://github.com/mifi/ffmpeg-build-script) release (see its README).
2. Windows and Linux: make a new [ffmpeg-builds](https://github.com/mifi/ffmpeg-builds) release (see its README).
3. Update the versions in [script/downloadFfmpeg.ts](./script/downloadFfmpeg.ts).
4. Read FFmpeg's `Changelog` and `doc/APIchanges` (and the release notes) since the previous version for changes that may affect LosslessCut, e.g. removed or renamed CLI options, changed muxer/demuxer defaults, seeking behaviour (`-ss`, `-avoid_negative_ts`), `ffprobe` JSON output, and codec/format support.
5. Test a CI build on each platform: cutting (keyframe and normal), merging, smart cut, capture frame, waveform/thumbnails and FFmpeg-assisted playback.

### Upgrade Electron

- `electron` and upgrade [electron.vite.config.ts](./electron.vite.config.ts) `target`s.
- `@electron/remote`

For every Electron or other dependency upgrade (especially major versions), go through its changelog / breaking changes (for Electron: [breaking changes](https://github.com/electron/electron/blob/main/docs/breaking-changes.md) and the [release notes](https://releases.electronjs.org/)) and check the APIs and behaviours LosslessCut relies on, like we do for [FFmpeg](#upgrade-ffmpeg).

If the upgrade drops an OS version or architecture, release it as a minor version and update:
- [requirements](docs/requirements.md) and `supportedOs` in [Home.tsx](./website/src/components/Home.tsx)
- removed architectures: the `electron-builder` targets in [package.json](./package.json), [afterPack.ts](./script/afterPack.ts), the [build workflow](./.github/workflows/build.yml) uploads and the [README](./README.md) download links
- removed macOS versions: `MACOSX_DEPLOYMENT_TARGET` in [ffmpeg-build-script](https://github.com/mifi/ffmpeg-build-script/blob/master/build-ffmpeg) can be raised to match, with the next FFmpeg upgrade (older targets still run on newer macOS, so there's no hurry). See [`LSMinimumSystemVersion`](#macos-lsminimumsystemversion).

### Keep dependencies up to date

```bash
yarn upgrade-interactive
```

Install scripts are disabled by default (`enableScripts: false` in `.yarnrc.yml`), so a
compromised dependency cannot run code just by being installed. No package currently needs an
exception.

Installs print `YN0004: <package> lists build scripts, but all build scripts have been
disabled` for packages whose scripts were skipped. That warning is not by itself a problem —
most install scripts in modern packages are no-ops that only matter when a prebuilt native
binary is missing, and some are explicitly skipped under Yarn anyway. Before granting an
exception, read the script and check whether the package actually works without it.

If it genuinely needs to build, opt that one package in:

```json
"dependenciesMeta": {
  "<package>": { "built": true }
}
```

Prefer verifying over granting: a package that silently fails to build usually surfaces as a
confusing runtime error, but a blanket `enableScripts: true` gives every dependency in the
tree the right to execute code at install time.

### i18n strings / Weblate

Run `yarn scan-i18n` to get the newest English strings and push so Weblate gets them.

Find the [latest PR](https://github.com/mifi/lossless-cut/pulls) from Weblate and **rebase+merge** it.

**Warning:** Do not squash and merge (see [here why](docs/translation.md#weblate))!

### Licenses file

`licenses.txt` (the licenses of the app's dependencies, linked from the app's Help menu) is generated and uploaded to each GitHub release by the release build (`.github/workflows/build.yml`). To look at it locally: `yarn generate-licenses`.

### Dependabot

https://github.com/mifi/lossless-cut/security/dependabot

## FFmpeg builds

- https://github.com/BtbN/FFmpeg-Builds
- https://www.gyan.dev/ffmpeg/builds/
- https://github.com/m-ab-s/media-autobuild_suite

## Other

- Update `copyrightYear` variable and [package.json](./package.json) `copyright`
