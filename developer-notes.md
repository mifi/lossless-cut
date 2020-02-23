## Development building / running

This app is built using Electron. Make sure you have at least node v8 and yarn installed. The app uses ffmpeg from PATH when developing.
```
git clone https://github.com/mifi/lossless-cut.git
cd lossless-cut
npm install
```

### Running
In one terminal:
```
npm run watch
```
In another:
```
npm start
```

## Release

### Release new version

- Commit changed
- `npm version ...`
- `git push && git push --tags`
- Wait for build and draft in Github actions
- Release draft at github
