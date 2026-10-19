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

Before releasing, consider [Maintenance chores](#maintenance-chores) first.

### Prepare and build new version

- `git checkout master`
- `git merge stores` (in case there's an old unmerged stores hotfix)
- **Prepare release notes**: `yarn release-notes` lists the `Changelog:` lines from commits since the last tag (see [AGENTS.md](./AGENTS.md)). Older commits don't have them, so also go through `node script/getCommits.ts`.
- Create a new file `versions/x.y.z.md` and write the most important highlights from the release notes, but **remove github issue #references**
- `node script/generateVersions.ts && git add versions/*.md src/renderer/src/versions.json && git commit -m 'Update change log'`
- *If Store-only hotfix release*
  - `git checkout stores`
  - `npm version patch`
- *If normal GitHub-first release*
  - `npm version minor && git --no-pager show`
- `git push --follow-tags`
- Wait for build and draft in Github actions

### Release built version

- Optionally, install the Mac App Store build from TestFlight (it shows up in App Store Connect after processing) and check that it starts and can open and export a file. This catches problems that only happen in the sandboxed MAS build.
- Open draft in github and add the prepared release notes
- *If GitHub release*
  - Release the draft
- *If Store-only hotfix release*
  - Remove all other artifacts and release the draft as **pre-release**

#### After releasing in GitHub

- *If Stores-only hotfix release*
  - `git checkout master`
  - `git merge stores`
- Bump [snap version](https://snapcraft.io/losslesscut/releases)
- Copy paste release notes and post to discord & twitter and re-tweet

### Release in Stores

Usually some time after the GitHub release, once no serious regressions have been reported.

#### Microsoft Store

1. Download `LosslessCut-win-x64-DONT-USE-THIS-FILE.appx` and `LosslessCut-win-arm64-DONT-USE-THIS-FILE.appx` from the GitHub release, and remove `-DONT-USE-THIS-FILE` from the file names
2. Open the [Partner Center](https://partner.microsoft.com/en-us/dashboard/products/9P30LSR4705L/overview) and click "Start update"
3. "Packages": click the caret next to "Unchanged", then drag-drop both renamed files into the upload area. Both architectures go in the same submission and the Store serves the right one to each device (if a submission ever used an `.appxbundle`, later ones must too, see [#2789](https://github.com/mifi/lossless-cut/issues/2789))
4. Tick "Roll out update gradually", start rollout with 0%, wait for the uploads to finish and click "Save"
5. "Submission Options" (caret): tick "Don't publish this submission until I select Publish now"
6. "Store listings" → "Languages supported in packages" → "English (United States)": replace "What's new in this version". If needed, also update "Description", "Product features" and screenshots
7. Go back and click "Submit for certification"
8. Once certified, publish it, and increase the rollout by ~15% every day or so

#### Mac App Store

Tag builds already upload the build to App Store Connect (`(MacOS) Upload to Mac App Store` in `build.yml`).

1. In [App Store Connect](https://appstoreconnect.apple.com/apps/1505323402/distribution), create a new version
2. "Build": click "Add Build" and pick the build of this version
3. Update "What's New in This Version". If needed, also update "Description" and screenshots
4. "App Store Version Release": tick "Manually release this version"
5. "Phased Release for App Store Automatic Updates": tick "Release update over 7-day period using phased release"
6. Save, then "Add for Review"
7. Once approved, release it

### After releasing existing GitHub version in Stores

- `git checkout stores`
- Find the tag just released in the Stores
- Merge this tag (from `master`) into `stores`: `git merge vX.Y.Z`
- `git push`
- `git checkout master`

### More info

For per-platform build/signing setup, see [this article](https://mifi.no/blog/automated-electron-build-with-release-to-mac-app-store-microsoft-store-snapcraft/).

### Yearly Apple certificate renewal

Apple sends an email when certificates are about to expire. Follow the "Certificate creation/renewal" section of [the article above](https://mifi.no/blog/automated-electron-build-with-release-to-mac-app-store-microsoft-store-snapcraft/). LosslessCut specifics:

- The Development provisioning profile is kept in the project root as `LosslessCut_Dev.provisionprofile` (gitignored) — replace it with the newly downloaded one, for use with `yarn pack-mas-dev`.

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

### Regenerate licenses file

```bash
yarn generate-licenses
#cp licenses.txt losslesscut.mifi.no/public/
```
Then deploy.

### Dependabot

https://github.com/mifi/lossless-cut/security/dependabot

## FFmpeg builds

- https://github.com/BtbN/FFmpeg-Builds
- https://www.gyan.dev/ffmpeg/builds/
- https://github.com/m-ab-s/media-autobuild_suite

## Other

- Update `copyrightYear` variable and [package.json](./package.json) `copyright`
