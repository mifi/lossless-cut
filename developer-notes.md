# Contributing

## Development setup

This app is built using Electron.
Make sure you have at least Node v16. The app uses ffmpeg from PATH when developing.

```bash
npm install -g yarn
```

```bash
git clone https://github.com/mifi/lossless-cut.git
cd lossless-cut
yarn
```

Note: `yarn` may take some time to complete.

### Installing `ffmpeg`

Run one of the below commands:
```bash
npm run download-ffmpeg-darwin-x64
npm run download-ffmpeg-darwin-arm64
npm run download-ffmpeg-linux-x64
npm run download-ffmpeg-win32-x64
```

### Running

```bash
npm start
```

### Building for production

See:
- https://www.electron.build/
- https://github.com/mifi/lossless-cut/blob/master/.github/workflows/build.yml

## Building mas-dev (Mac App Store) build locally

This will sign using the development provisioning profile:

```
npm run pack-mas-dev
```

MAS builds have some restrictions, see `isMasBuild` variable in code. In particular, any file cannot be read without the user's consent.

NOTE: when MAS (dev) build, Application Support will instead be here:
```
~/Library/Containers/no.mifi.losslesscut-mac/Data/Library/Application Support
```

### Starting over fresh

```
rm -rf ~/Library/Containers/no.mifi.losslesscut-mac
```

## Windows Store

Windows store version is built as a Desktop Bridge app (with `runFullTrust` capability). This means the app has access to essentially everything the user has access to, and even `internetClient` is redundant.

- https://learn.microsoft.com/en-us/windows/uwp/packaging/app-capability-declarations
- https://learn.microsoft.com/en-us/archive/blogs/appconsult/a-simpler-and-faster-way-to-publish-your-desktop-bridge-applications-on-the-microsoft-store
- https://stackoverflow.com/a/52921641/6519037

## Releasing

For per-platform build/signing setup, see [this article](https://mifi.no/blog/automated-electron-build-with-release-to-mac-app-store-microsoft-store-snapcraft/).

### Release new version

- Commit changes
- `npm version ...`
- `git push && git push --tags`
- Wait for build and draft in Github actions
- Open draft in github and add Release notes
- For files `LosslessCut-mac-universal.pkg` and `LosslessCut-win-x64.appx` add prefix `-DO-NOT-DOWNLOAD`
- Release the draft
- Bump [snap version](https://snapcraft.io/losslesscut/listing)
- `npm run scan-i18n` to get the newest English strings and push so weblate gets them

## Minimum OS version

Minimum supported OS versions for Electron. As of electron 22:

- MacOS High Sierra 10.13
- Windows 10

### MacOS [`LSMinimumSystemVersion`](https://developer.apple.com/documentation/bundleresources/information_property_list/lsminimumsystemversion)

How to check the value:

```bash
npm run pack-mas-dev
cat dist/mas-dev-arm64/LosslessCut.app/Contents/Info.plist
```

```
<key>LSMinimumSystemVersion</key>
<string>10.13</string>
```

`LSMinimumSystemVersion` can be overridden in `electron-builder` by [`mac.minimumSystemVersion`](https://www.electron.build/configuration/mac.html)

See also `MACOS_MIN` in [ffmpeg-build-script](https://github.com/mifi/ffmpeg-build-script/blob/master/build-ffmpeg).

Links:
- https://support.google.com/chrome/a/answer/7100626
- https://bignerdranch.com/blog/requiring-a-minimum-version-of-os-x-for-your-application/
- [#1386](https://github.com/mifi/lossless-cut/issues/1386)

## Maintainence chores

### Keep dependencies up to date
- ffmpeg
- electron
- package.json

### i18n
`npm run scan-i18n`

### Licenses

#### Generate summary

```
npx license-checker --summary
```

#### Regenerate licenses file

```
npm run generate-licenses
#cp licenses.txt losslesscut.mifi.no/public/
```
Then deploy.
