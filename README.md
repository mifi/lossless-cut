# LosslessCut 🎥 [![Travis](https://img.shields.io/travis/mifi/lossless-cut.svg)]()

Simple, cross platform tool for lossless trimming / cutting of video and audio files. Great for rough processing of large video files taken from a video camera, GoPro, drone, etc. It lets you quickly extract the good parts from your videos and discard GBs of data without losing quality. It doesn't do any decoding / encoding and is therefore extremely fast. Also allows for taking JPEG snapshots of the video at the selected time. This app uses the awesome ffmpeg🙏 for doing the grunt work. Also supports lossless cutting in the most common audio formats. ffmpeg is included in the app.



![Demo](https://thumbs.gfycat.com/HighAcclaimedAnaconda-size_restricted.gif)

## Installing / running

- Download [latest LosslessCut from releases](https://github.com/mifi/lossless-cut/releases)
- Run LosslessCut app/exe
- On OSX, to open LosslessCut.app, Right Click > Open to bypass the security warning.

## Documentation

### Supported platforms
- Mac OS X
- Windows (64/32bit)
- Linux (64/32bit, not tested)

### Supported formats

Since LosslessCut is based on Chromium and uses the HTML5 video player, not all ffmpeg supported formats will be supported.
The following formats/codecs should generally work: MP4, MOV, WebM, MKV, OGG, WAV, MP3, AAC, H264, Theora, VP8, VP9
For more information about supported formats / codecs, see https://www.chromium.org/audio-video.

### Typical workflow
- Drag drop a video file into player to load or use <kbd>⌘</kbd>/<kbd>CTRL</kbd>+<kbd>O</kbd>.
- Press <kbd>SPACE</kbd> to play/pause
- Select the cut start and end time.  Press <kbd>I</kbd> to select the start time, <kbd>O</kbd> to select the end time for the cut.
- Press the rotation button if you want to set rotation metadata
- Press the scissors button to export the slice
- Press the camera button to take a snapshot

The original video files will not be modified. Instead it creates a lossless export in the same directory as the original file with from/to timestamps. Note that the cut is currently not precise around the cutpoints, so video before/after the nearest keyframe will be lost. EXIF data is preserved.

### Keyboard shortcuts
Press <kbd>h</kbd> To show/hide list of shortcuts

For old shortcuts see here:
https://github.com/mifi/lossless-cut/blob/41d6991c11b0a82b08344fd22a1ea094af217417/README.md#keyboard-shortcuts

### Known issues
- Output videos will have an empty portion in the beginning, see discussion in [#13](https://github.com/mifi/lossless-cut/pull/13)
- If you get an error when cutting any kind of file under Windows, please check your anti-virus. It might be blocking execution of ffmpeg, see [#18](https://github.com/mifi/lossless-cut/issues/18)

## Development building / running

This app is built using Electron. Make sure you have at least node v4 with npm 3. The app uses ffmpeg from PATH when developing.
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
Then:
```
npm start
```

### Release new version
```
# Commit changes
# Wait for Travis
npm version ...
# Update CHANGELOG.md
# Commit CHANGELOG.md
# Push
npm run download-ffmpeg
npm run extract-ffmpeg
npm run build
npm run icon-gen
npm run package
npm run release

```

## Credits
- App icon made by [Dimi Kazak](http://www.flaticon.com/authors/dimi-kazak "Dimi Kazak") from [www.flaticon.com](http://www.flaticon.com "Flaticon") is licensed by [CC 3.0 BY](http://creativecommons.org/licenses/by/3.0/ "Creative Commons BY 3.0")
