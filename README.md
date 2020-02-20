# LosslessCut 🎥 [![Travis](https://img.shields.io/travis/mifi/lossless-cut.svg)](https://travis-ci.org/mifi/lossless-cut) [![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://paypal.me/mifino)

**The swiss army knife user interface for lossless ffmpeg**

LosslessCut aims to be the ultimate cross platform ffmpeg GUI for extremely fast and lossless operations on video, audio, subtitle and other related files.
The main feature is lossless trimming/cutting of video and audio files. Great for saving space by rough cutting your large video files taken from a video camera, GoPro, drone, etc. It lets you quickly extract the good parts from your videos and discard many gigabytes of data without doing a slow re-encode and thereby losing quality. Or you can add a music or subtitle track to your video without needing to encode. Everything is extremely fast because it does an almost direct data copy, fueled by the awesome ffmpeg for doing the grunt work.

![Demo](https://github.com/mifi/gifs/raw/master/2019-01-28-lossless-cut.gif)

**Shameless Plugs**

🆕I made an easy to use Instagram bot with a GUI: [SimpleInstaBot](https://github.com/mifi/SimpleInstaBot/)

I made a tool for cross platform sharing of files between computer/phone over the local network: [ezshare](https://github.com/mifi/ezshare)


## Features
- Lossless cutting of most video and audio formats
- Losslessly cut out parts of video/audio (for cutting away commercials etc.)
- Lossless merge/concatenation of arbitrary files (with identical codecs parameters, e.g. from same camera)
- Lossless stream editing: Combine arbitrary tracks from multiple files (ex. add music or subtitle track to a video file)
- Losslessly extract all tracks from a file (extract video, audio, subtitle and other tracks from one file into separate files)
- Remux into different output format
- Take full-resolution snapshots from videos in JPEG/PNG format
- Manual input range of cutpoints
- Apply a timecode offset
- Change rotation/orientation metadata in videos
- View technical data about all streams

## Example lossless use cases

### Remove audio tracks from a file

### Add music to a video (or replace existing audio track)

### Include a subtitle into a video

### Extract music track from a video and cut it to your needs

### Cut out commercials from a recorded TV show

Without having to re-encode. You can also change format from TS to MP4 at the same time.

### Fix rotation of a video that has the wrong orientation flag set

Great for rotating phone videos that come out the wrong way without actually re-encoding the video.

### Change a H264 MKV video to MOV or MP4

### Advanced multi-step workflows

**Tip:** you can use LosslessCut in multiple passes in order to achieve separate trimming of individual tracks:
1. Open a file an export all tracks
2. Open the exported track files independently and cut them as desired
3. Add the track back to the video and combine them to one output video


## Download

- [Mac OS X](https://github.com/mifi/lossless-cut/releases/latest/download/LosslessCut-mac.dmg)
- [Windows](https://github.com/mifi/lossless-cut/releases/latest/download/LosslessCut-win.exe)
- [Linux AppImage](https://github.com/mifi/lossless-cut/releases/latest/download/LosslessCut-linux.AppImage)
- [Linux snap](https://github.com/mifi/lossless-cut/releases/latest/download/LosslessCut-linux.snap)
- [Linux tar.bz2](https://github.com/mifi/lossless-cut/releases/latest/download/LosslessCut-linux.tar.bz2)

NOTE: After installing you may need to right click the application icon and then "Open" in order to bypass "Untrusted app" dialogs. This is because Microsoft requires a $300/year certificate just to remove this block (I'm not going to pay for that.) Alternatively try to google `windows how to run untrusted app`.

## Supported formats

Since LosslessCut is based on Chromium and uses the HTML5 video player, not all ffmpeg supported formats will be supported smoothly.
The following formats/codecs should generally work: MP4, MOV, WebM, MKV, OGG, WAV, MP3, AAC, H264, Theora, VP8, VP9
For more information about supported formats / codecs, see https://www.chromium.org/audio-video.

Unsupported files can be remuxed (fast) or encoded (slow) to a friendly format/codec from the `File` menu. A processed version of the file (without audio) will then be created and opened in the player. The cut/export operation will still be performed on the original file, so it will be lossless. This allows for potentially opening any file that ffmpeg is able to decode.


## Typical workflow
- Drag drop a video file into player or use <kbd>⌘</kbd>/<kbd>CTRL</kbd>+<kbd>O</kbd>.
- Press <kbd>SPACE</kbd> to play/pause or <kbd>◀</kbd><kbd>▶</kbd>, <kbd>,</kbd><kbd>.</kbd> or mouse/trackpad wheel to seek back/forth
- Select the cut segment's start and end time by moving the time marker and then pressing <kbd>I</kbd> to set start time, and <kbd>O</kbd> to set end time. *Note that the segments you select will be **preserved** and exported to a new file. You can change this behavior with the Yin Yang symbol ☯️, after which it will instead **cut away** all selected segments.*
- *(optional)* If you want to add more than one segment, move to the desired start time and press <kbd>+</kbd>, then select the next segment start/end times with <kbd>I</kbd>/<kbd>O</kbd>.
- *(optional)* If you want to re-merge all the selected segments to one file after cutting, toggle the button `Separate files` to `Merge cuts`.
- *(optional)* If you want to export to a certain dir, press the `Working dir unset` button (default: Input file path)
- *(optional)* If you want to change orientation, press the rotation button
- *(optional)* By default, audio, video and subtitle tracks from the input file will be exported. Press the `Tracks` button to customise and/or add new tracks from other files.
- *(optional)* select a new output format
- Press the `Export` button (or <kbd>E</kbd>) to run the export
- Press the camera button (or <kbd>C</kbd>) if you want to take a JPEG/PNG snapshot from the current time
- If you want to move the original file to trash, press the trash button
- For best results you may need to trial and error with another output format (matroska takes nearly everything), change keyframe cut mode or disable some tracks, see known issues below.

Note: The original video files will not be modified. Instead it creates a lossless export in the same directory as the original file with from/to timestamps. Note that the cut is currently not precise around the cutpoints, so video before/after the nearest keyframe will be discarded. EXIF metadata is preserved.

## Keyboard shortcuts
Press <kbd>H</kbd> To show/hide list of shortcuts

## Known issues & limitations
- **Cutting times are not accurate and will be "rounded" to the nearest keyframe.** In the future I plan on showing keyframes in the timecale, and eventually implement a "smart cut" feature that re-encodes only the part before the keyframe. See [#126](https://github.com/mifi/lossless-cut/issues/126)
- Your mileage may vary when it comes to `Keyframe cut` vs `Normal cut`. You may need to try both, depending on the video. See [ffmpeg](https://trac.ffmpeg.org/wiki/Seeking) also has documentation about these two seek/cut modes. `Keyframe cut` means `-ss` *before* `-i` and `Normal cut` means `-ss` *after* `-i`.
- When exporting you may lose some proprietary data tracks (like `tmcd`, `fdsc` and `gpmd` added by GoPro). These can be exported to separate files however
- H265 is not supported natively. There is partial support with very low FPS and no audio preview. Alternatively convert to friendly codec (slow) from the menu, see [#88](https://github.com/mifi/lossless-cut/issues/88)


## Troubleshooting

- If you get an error when cutting or opening any kind of file under Windows, please check your anti-virus. It might be blocking execution of ffmpeg, see [#18](https://github.com/mifi/lossless-cut/issues/18)

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

This project is maintained by me alone. The project will always remain free and open source, but if it's useful for you, consider supporting me. :) It will give me extra motivation to improve it. Or even better [donate to ffmpeg](https://www.ffmpeg.org/donations.html) because they are doing the world a big favor 🙏

[Paypal](https://paypal.me/mifino)

## Credits
- App icon made by [Dimi Kazak](http://www.flaticon.com/authors/dimi-kazak "Dimi Kazak") from [www.flaticon.com](http://www.flaticon.com "Flaticon") is licensed by [CC 3.0 BY](http://creativecommons.org/licenses/by/3.0/ "Creative Commons BY 3.0")

---

Made with ❤️ in 🇳🇴
