## Development

This app is built using Electron.
Make sure you have at least Node v14. The app uses ffmpeg from PATH when developing.

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
- Release draft at github
- Bump [snap version](https://snapcraft.io/losslesscut/listing)
- `npm run scan-i18n` to get the newest Englist strings and push so weblate gets them

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
#cp licenses.txt losslesscut.mifi.no/public//
```
Then deploy.
