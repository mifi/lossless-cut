# LosslessCut 🎥 [![Travis](https://img.shields.io/travis/mifi/lossless-cut.svg)](https://travis-ci.org/mifi/lossless-cut) [![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://paypal.me/mifino)

Simple and ultra fast cross platform tool for lossless trimming/cutting of video and audio files. Great for saving space by rough cutting your large video files taken from a video camera, GoPro, drone, etc. It lets you quickly extract the good parts from your videos and discard many gigabytes of data without doing a slow re-encode and thereby losing quality. It extremely fast because it does an almost direct data copy. It uses the awesome ffmpeg (included) for doing the grunt work.

![Demo](https://thumbs.gfycat.com/HighAcclaimedAnaconda-size_restricted.gif)

## Features
- Lossless cutting of common video and audio formats
- Lossless merge of files (identical codecs)
- Lossless extracting of all streams from a file (video, audio, subtitle, ++)
- Cut out multiple segments at the same time
- Take full-resolution snapshots from videos in JPEG/PNG format
- Manual input range of cutpoints
- Can include more than 2 streams or remove audio track (optional)
- Apply timecode offset
- Change rotation/orientation metadata in videos. Great for rotating phone videos that come out the wrong way without actually re-encoding the video.

## Installing / running

- Download [latest LosslessCut from releases](https://github.com/mifi/lossless-cut/releases)
- Run LosslessCut app/exe
- On macOS, to open LosslessCut.app, Right Click > Open to bypass the security warning.

## Supported platforms
- macOS
- Windows (64/32bit)
- Linux (64/32bit, not tested)

## Supported formats

Since LosslessCut is based on Chromium and uses the HTML5 video player, not all ffmpeg supported formats will be supported directly.
The following formats/codecs should generally work: MP4, MOV, WebM, MKV, OGG, WAV, MP3, AAC, H264, Theora, VP8, VP9
For more information about supported formats / codecs, see https://www.chromium.org/audio-video.

Unsupported files can now be remuxed (fast) or encoded (slow) to a friendly format/codec from the `File` menu. A processed version of the file will then be opened in the player. The cut operation will still be performed using the original file as input, so it will be lossless. This allows for potentially opening any file that ffmpeg is able to decode.


## Typical workflow
- Drag drop a video file into player to load or use <kbd>⌘</kbd>/<kbd>CTRL</kbd>+<kbd>O</kbd>.
- Press <kbd>SPACE</kbd> to play/pause
- Select the cut start and end time.  Press <kbd>I</kbd> to select the start time, <kbd>O</kbd> to select the end time for the cut.
- Press the custom output dir button if you want to export to a certain dir (default: source file dir)
- Press the rotation button if you want to override orientation metadata
- Press the scissors button (or <kbd>E</kbd>) to export the slice
- Press the camera button (or <kbd>C</kbd>) to take a snapshot
- Press the trash button if you want to move the original file to trash

The original video files will not be modified. Instead it creates a lossless export in the same directory as the original file with from/to timestamps. Note that the cut is currently not precise around the cutpoints, so video before/after the nearest keyframe will be lost. EXIF data is preserved.

## Keyboard shortcuts
Press <kbd>h</kbd> To show/hide list of shortcuts

For old shortcuts see here:
https://github.com/mifi/lossless-cut/blob/41d6991c11b0a82b08344fd22a1ea094af217417/README.md#keyboard-shortcuts

## Known issues
- If you have trouble with audio sync or something else with the output video, try toggling the button `nc` *(normal cut)* to `kc` *(kc cut)*. See discussion in [#13](https://github.com/mifi/lossless-cut/pull/13)
- If you get an error when cutting any kind of file under Windows, please check your anti-virus. It might be blocking execution of ffmpeg, see [#18](https://github.com/mifi/lossless-cut/issues/18)

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

## Donate 🙈

This project is maintained by me alone. The project will always remain free and open source, but if it's useful for you, consider supporting me. :) It will give me extra motivation to improve it.

- Paypal: [https://paypal.me/mifino](https://paypal.me/mifino)
- Bitcoin: 1ApBmaN98YtSzTuYofEoSRnYBUycPr5qtC

## Credits
- App icon made by [Dimi Kazak](http://www.flaticon.com/authors/dimi-kazak "Dimi Kazak") from [www.flaticon.com](http://www.flaticon.com "Flaticon") is licensed by [CC 3.0 BY](http://creativecommons.org/licenses/by/3.0/ "Creative Commons BY 3.0")
