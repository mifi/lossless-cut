# Contributing

## [Translations](docs/translation.md)

## Development environment setup

This app is built using Electron.
Make sure you have at least Node v16. The app uses ffmpeg from PATH when developing.

```bash
git clone https://github.com/mifi/lossless-cut.git
cd lossless-cut
yarn
```

Note: `yarn` may take some time to complete.

### Installing `ffmpeg`

Run one of the below commands:
```bash
yarn download-ffmpeg-darwin-x64
yarn download-ffmpeg-darwin-arm64
yarn download-ffmpeg-linux-x64
yarn download-ffmpeg-win32-x64
```

For Windows, you may have to install [7z](https://www.7-zip.org/download.html), and then put the 7z folder in your `PATH`.

### Running

```bash
yarn dev
```

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

Before releasing, consider [Maintainence chores](#maintainence-chores) first.

### Prepare and build new version

- `git checkout master`
- `git merge stores` (in case there's an old unmerged stores hotfix)
- **Prepare release notes** from commit history
- Create a new file `versions/x.y.z.md` and write the most important highlights from the release notes, but **remove github issue #references**
- `tsx script/generateVersions.mts && git add versions/*.md src/renderer/src/versions.json && git commit -m 'Update change log'`
- *If Store-only hotfix release*
  - `git checkout stores`
  - `npm version patch`
- *If normal GitHub-first release*
  - `npm version minor && git --no-pager show`
- `git push --follow-tags`
- Wait for build and draft in Github actions

### Release built version

- Open draft in github and add the prepared release notes
- Add suffix `-DONT-USE-THIS-FILE` to `LosslessCut-mac-universal.pkg` and `LosslessCut-win-x64.appx`
- *If GitHub release*
  - Release the draft
- *If Store-only hotfix release*
  - Remove all other artifacts and release the draft as **pre-release**

#### After releasing in GitHub

- *If Stores-only hotfix release*
  - `git checkout master`
  - `git merge stores`
- Bump [snap version](https://snapcraft.io/losslesscut/releases)

### After releasing existing GitHub version in Stores

- `git checkout stores`
- Find the tag just released in the Stores
- Merge this tag (from `master`) into `stores`: `git merge vX.Y.Z`
- `git push`
- `git checkout master`

### More info

For per-platform build/signing setup, see [this article](https://mifi.no/blog/automated-electron-build-with-release-to-mac-app-store-microsoft-store-snapcraft/).

## Weblate

`yarn scan-i18n` to get the newest English strings and push so Weblate gets them.

Find the [latest PR](https://github.com/mifi/lossless-cut/pulls) from Weblate and **rebase+merge** it.

**Warning:** Do not squash and merge (see [here why](docs/translation.md#weblate))!

## Minimum OS version

See [requirements](docs/requirements.md).

### MacOS [`LSMinimumSystemVersion`](https://developer.apple.com/documentation/bundleresources/information_property_list/lsminimumsystemversion)

How to check the value:

```bash
yarn pack-mas-dev
cat dist/mas-dev-arm64/LosslessCut.app/Contents/Info.plist
```

```xml
<key>LSMinimumSystemVersion</key>
<string>10.13</string>
```

`LSMinimumSystemVersion` can be overridden in `electron-builder` by [`mac.minimumSystemVersion`](https://www.electron.build/configuration/mac.html)

See also `MACOSX_DEPLOYMENT_TARGET` in [ffmpeg-build-script](https://github.com/mifi/ffmpeg-build-script/blob/master/build-ffmpeg).

Links:
- https://support.google.com/chrome/a/answer/7100626
- https://bignerdranch.com/blog/requiring-a-minimum-version-of-os-x-for-your-application/
- [#1386](https://github.com/mifi/lossless-cut/issues/1386)

## Maintainence chores

### Keep dependencies up to date
- FFmpeg: [ffmpeg-build-script](https://github.com/mifi/ffmpeg-build-script), [ffmpeg-builds](https://github.com/mifi/ffmpeg-builds) and [package.json](./package.json) download scripts.
- `electron` and upgrade [electron.vite.config.ts](./electron.vite.config.ts) `target`s.
- `@electron/remote`
- `package.json` / `yarn.lock`

### i18n
```bash
yarn scan-i18n
```

### Generate license summary

```bash
npx license-checker --summary
```

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

- Update `copyrightYear`
