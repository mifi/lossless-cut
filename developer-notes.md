## Development building / running

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

### ffmpeg

Run one of the below commands:
```bash
npm run download-ffmpeg-mac
npm run download-ffmpeg-linux
npm run download-ffmpeg-windows
```

### Running

```bash
npm start
```

## Testing mas-dev build locally

This will sign using the development provisioning profile:

```
npm run pack-mas-dev
```

## Release

For per-platform build/signing setup, see https://blog.mifi.no/2020/03/31/automated-electron-build-with-release-to-mac-app-store-microsoft-store-snapcraft/

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
#cp licenses.txt mifi.no/public/losslesscut/
```
Then deploy.
