<div align="center">
	<br>
	<br>
  <p><a href="https://mifi.no/losslesscut/"><img src="src/icon.svg" width="130" alt="LosslessCut" /></a></p>
  <p><b>LosslessCut</b></p>
  The swiss army knife of lossless video/audio editing
	<br>
  <img src="https://github.com/mifi/lossless-cut/workflows/Build/release/badge.svg" />
  <a href="https://paypal.me/mifino/usd"><img src="https://img.shields.io/badge/Donate-PayPal-green.svg" /></a> <a href="https://github.com/mifi/lossless-cut#download"><img src="https://img.shields.io/github/v/release/mifi/lossless-cut" /></a>
	<br>
	<br>
  <a href="https://mifi.no/thanks/">Thanks to all my supporters</a>
	<br>
	<br>
  <p align="center"><img src="https://github.com/mifi/lossless-cut/raw/master/main_screenshot.jpg" width="600" alt="screenshot" /></p>
	<br>
	<br>
</div>


LosslessCut aims to be the ultimate cross platform FFmpeg GUI for extremely fast and lossless operations on video, audio, subtitle and other related media files.
The main feature is lossless trimming and cutting of video and audio files, which is great for saving space by rough-cutting your large video files taken from a video camera, GoPro, drone, etc. It lets you quickly extract the good parts from your videos and discard many gigabytes of data without doing a slow re-encode and thereby losing quality. Or you can add a music or subtitle track to your video without needing to encode. Everything is extremely fast because it does an almost direct data copy, fueled by the awesome FFmpeg which does all the grunt work.

## Features
- Lossless cutting of most video and audio formats
- [Smart cut](https://github.com/mifi/lossless-cut/issues/126) (experimental)
- Losslessly cut out parts of video/audio (for cutting away commercials etc.)
- Losslessly rearrange the order of video/audio segments
- Lossless merge/concatenation of arbitrary files (with identical codecs parameters, e.g. from the same camera)
- Lossless stream editing
  - Combine arbitrary tracks from multiple files (ex. add music or subtitle track to a video file)
  - Remove unneeded tracks
  - Replace or re-encode only some tracks
  - Extract all tracks from a file (extract video, audio, subtitle, attachments and other tracks from one file into separate files)
- Batch view for fast multi-file workflow
- Keyboard shortcut workflow
- Lossless remux video/audio into any compatible output format
- Take full-resolution snapshots from videos in JPEG/PNG format, or export ranges of video frames to images
- Manual input of cutpoint times
- Apply a per-file timecode offset (and auto load timecode from file)
- Edit file metadata, per-track metadata and per-track disposition
- Change rotation/orientation metadata in videos
- View technical data about all tracks
- Timeline zoom and frame/keyframe jumping for cutting around keyframes
- Video thumbnails and audio waveform
- Saves per project cut segments to project file
- View FFmpeg last command log so you can modify and re-run recent commands on the command line
- Undo/redo
- Give labels to cut segments
- Annotate segments with tags
- Import/export segments: MP4/MKV chapter marks, Text file, YouTube, CSV, CUE, XML (DaVinci, Final Cut Pro) and more
- MKV/MP4 embedded chapters marks editor
- View subtitles
- Customizable keyboard hotkeys

## Example lossless use cases

- Cut out commercials from a recorded TV show (and re-format from TS to MP4)
- Remove audio tracks from a file
- Extract music track from a video and cut it to your needs
- Add music to a video (or replace existing audio track)
- Combine audio and video tracks from separate recordings
- Include an external subtitle into a video
- Quickly change a H264/H265 MKV video to MOV or MP4 for playback on iPhone
- Import a list of cut times from other tool as a EDL (edit decision list, CSV) and run these cuts with LosslessCut
- Export a list of cut times as a CSV EDL and process these in another tool
- Quickly cut a file by its MP4/MKV chapters
- Quickly cut a [YouTube video](https://youtube-dl.org/) by its chapters (or music times from a comment)
- Change the language of a file's audio/subtitle tracks
- Attach cover art to videos
- Change author, title, GPS position, recording time of a video
- Fix rotation of a video that has the wrong orientation flag set
  - Great for rotating phone videos that come out the wrong way without actually re-encoding the video.
- Loop a video / audio clip X times quickly without re-encoding
  - See [#284](https://github.com/mifi/lossless-cut/issues/284)
- Convert a video or parts of it into X image files (not lossless)

### Export cut times as YouTube Chapters
1. Export with Merge and "Create chapters from merged segments" enabled
2. Open the exported file and select "Import chapters" in the dialog
3. File -> Export project -> YouTube Chapters

### Re-encode only the audio track, keeping the lossless video track

First export each track as individual files. Then use Handbrake or similar to re-encode the audio file. Then use the `Tools->Merge` in LosslessCut to merge the original video stream with your Handbrake output (or drag it into your original LosslessCut video to include it as a new track.)

### Advanced multi-step workflows

**Tip:** you can use LosslessCut in multiple passes in order to achieve separate trimming of individual tracks:
1. Open a file an export all tracks as individual files
2. Open the exported track files independently and cut them as desired
3. Add the track back to the video and combine them to one output video

## Download

If you want to support my continued work on LosslessCut, and you want the advantage of a secure and simple installation process with automatic updates, consider getting it from your favorite store:

<a href="https://apps.apple.com/app/id1505323402"><img src="mac-app-store-badge.svg" alt="Mac App Store" height="50"/></a> <a href="https://www.microsoft.com/store/apps/9P30LSR4705L?cid=storebadge&ocid=badge"><img src="ms-store-badge.svg" alt="MS badge" height="50"/></a> <a href="https://snapcraft.io/losslesscut"><img src="https://snapcraft.io/static/images/badges/en/snap-store-black.svg" alt="Snapcraft" height="50"/></a>

If you prefer to download the executables manually, this will of course always be free:

- Mac OS X: [DMG](https://github.com/mifi/lossless-cut/releases/latest/download/LosslessCut-mac-x64.dmg)
- Window: [EXE](https://github.com/mifi/lossless-cut/releases/latest/download/LosslessCut-win-x64.exe) (portable/self-extracting) / [ZIP](https://github.com/mifi/lossless-cut/releases/latest/download/LosslessCut-win-x64.zip) (portable)
- Linux: [x64 tar.bz2](https://github.com/mifi/lossless-cut/releases/latest/download/LosslessCut-linux-x64.tar.bz2) / [x64 AppImage](https://github.com/mifi/lossless-cut/releases/latest/download/LosslessCut-linux-x86_64.AppImage) / [arm64 tar.bz2](https://github.com/mifi/lossless-cut/releases/latest/download/LosslessCut-linux-arm64.tar.bz2)
- [More releases](https://github.com/mifi/lossless-cut/releases)

If you find LosslessCut useful, I'm very thankful for [donations](https://github.com/mifi/lossless-cut#donate-).

### Difference between App Stores and Github download

They have exactly the same in-app features, except a few platform limitations. Apple doesn't allow opening VOB files with App Store apps. Apple App Store apps need to prompt for output directory. LosslessCut version in the App Stores lags a few versions behind the GitHub version, because I want to be sure that the new versions work perfectly before releasing in the App Stores. GitHub version can contain new, untested features and may contain some bugs. I consider the newest GitHub versions to be a public "beta" test.

## Supported formats

Since LosslessCut is based on Chromium and uses the HTML5 video player, not all FFmpeg supported formats will be supported smoothly.
The following formats/codecs should generally work: MP4, MOV, WebM, MKV, OGG, WAV, MP3, AAC, H264, Theora, VP8, VP9
For more information about supported formats / codecs, see https://www.chromium.org/audio-video.

Unsupported files can still be converted to a supported format/codec from the `File` menu. (Try the fastest variant first.) A low quality version of the file (without audio) will then be created and opened in the player. The cut/export operation will still be performed on the original file, so it will be lossless. This allows for potentially opening any file that FFmpeg is able to decode.

## Video demos

- [Common features](https://www.youtube.com/watch?v=pYHMxXy05Jg)
- [How to add a thumbnail to an MP4](https://www.youtube.com/watch?v=4pYJ93cn80E)
- [How to add multi-language audio to a video](https://www.youtube.com/watch?v=MRBGDsuw_WU)

- **Your video here?** If you would like to make a video showing off LosslessCut use cases, let me know and I can link it here!

### Typical workflow

- Drag drop a video file into player or use <kbd>⌘</kbd>/<kbd>CTRL</kbd>+<kbd>O</kbd>.
- Press <kbd>SPACE</kbd> to play/pause or <kbd>◀</kbd><kbd>▶</kbd>, <kbd>,</kbd><kbd>.</kbd> or mouse/trackpad wheel to seek back/forth.
- Select the cut segment's start and end time by moving the time marker and then pressing <kbd>I</kbd> to set start time, and <kbd>O</kbd> to set end time.
  - Note that all segments you create will be **preserved** and exported as new files. You can change this behavior with the **Yin Yang** symbol ☯️, in which case it will instead **remove** all selected segments and export the parts **between** segments.
  - Note also that start times will not be accurate, see [Known issues](#known-issues--limitations)
- *(optional)* If you want to add more than one segment, move to the desired start time and press <kbd>+</kbd>, then select the next segment start/end times with <kbd>I</kbd>/<kbd>O</kbd>.
- *(optional)* If you want to re-merge all the selected segments into one file after cutting, toggle the button `Separate files` to `Merge cuts`.
- *(optional)* If you want to export to a certain output folder, press the `Working dir unset` button (default: Input file folder)
- *(optional)* If you want to change orientation, press the **rotation** button
- *(optional)* By default, audio, video and subtitle tracks from the input file will be cut and exported. Press the `Tracks` button to customise and/or add new tracks from other files.
- *(optional)* select a new output format
- *(optional)* In the right-hand segments panel, right click a segment for options, or drag-drop to reorder. Segments will appear in this order in the merged output.
- **When done, press the `Export` button (or <kbd>E</kbd>) to show an overview with export options.**
- *(optional)* adjust any export options
- **Then press `Export` again to confirm the export**
- Press the **Camera** button (or <kbd>C</kbd>) if you want to take a JPEG/PNG snapshot from the current time
- If you want to move the original file to trash, press the **trash** button
- For best results you may need to trial and error with another output format (Matroska takes nearly everything), change keyframe cut mode or disable some tracks (see known issues below).
- Press <kbd>H</kbd> to view help and all keyboard shortcuts.
- **Note:** The original video file will not be modified. Instead, a file is created file in the same directory as the original file with from/to timestamps in the file name.

## Known issues & limitations

- **Cutting times are not accurate!** Start cut time will be "rounded" to the nearest **previous** keyframe. This means that you often have **move the start cut time to few frames after** the desired keyframe.
  - Lossless cutting is not an exact science. For some codecs, it just works. For others, you may need to trial and error depending on the codec, keyframes etc to get the best cut. See [#330](https://github.com/mifi/lossless-cut/issues/330)
  - Your mileage may vary when it comes to `Keyframe cut` vs `Normal cut`. You may need to try both, depending on the video. [ffmpeg](https://trac.ffmpeg.org/wiki/Seeking) also has documentation about these two seek/cut modes. `Keyframe cut` means `-ss` *before* `-i` and `Normal cut` means `-ss` *after* `-i`.
  - You may try to enable the new "Smart cut" mode. However it is very experimental and may not work for most files.
- When exporting you may lose some proprietary data tracks (like `tmcd`, `fdsc` and `gpmd` added by GoPro). These can however be losslessly exported to separate files.
- EXIF/metadata can be preserved (see Export Options dialog), but it doesn't always output compliant files, so use it carefully.
- Some codecs are not supported natively. There is partial support with low quality playback and no audio. You can convert to a supported codec from the File menu, see [#88](https://github.com/mifi/lossless-cut/issues/88), however it may take some time.

## Troubleshooting / FAQ

- Windows: What's the difference between `.exe` and `.zip` downloads? `.exe` will self-extract on startup to a temp folder and is therefore slower to start up. `.zip` must be extracted manually but is very fast to start up.
- Windows: If you get an error when cutting or opening any kind of file, try to disable your anti-virus. See [#18](https://github.com/mifi/lossless-cut/issues/18)
- Windows: How to uninstall LosslessCut? There is no installer. Just delete the EXE file or containing folder. User files are stored in your [appData](https://www.electronjs.org/docs/api/app#appgetpathname) folder.
- Linux: If you get an error like `FATAL:setuid_sandbox_host.cc(157)] The SUID sandbox helper binary was found, but is not configured correctly. Rather than run without sandboxing I'm aborting now.`, try to run it as `./lossless-cut --no-sandbox`. See [#258](https://github.com/mifi/lossless-cut/issues/258)
- If any other problem, check [Known issues](#known-issues--limitations), or please search for existing issues before you file an issue here on GitHub.
- If the app crashes immediately upon startup, check the permissions of your User and Temp folders, see [61](https://github.com/mifi/lossless-cut/issues/61).
- Completely white window when starting up? Try to run with `--disable-gpu` - See [781](https://github.com/mifi/lossless-cut/issues/781).

If you have an issue you can check the developer tools for any errors or clues. Menu: `Tools` -> `Toggle Developer Tools`

## CSV import/export

- The CSV export/import function takes CSV files with one cut segment on each line. Each line contains three columns: `segment start`, `segment end`, `label`.
- `segment start` and `segment end` are expressed in seconds or left empty. Empty `segment end` means segment ends at the duration of the video.
- Use comma `,` to separate the fields (**not** semicolon `;`)

### example.csv
```csv
,56.9568,First segment starting at 0
70,842.33,"Another quoted label"
1234,,Last segment
```

## Command line interface (CLI)

### Open one or more files:
```bash
LosslessCut file1.mp4 file2.mkv
```

### Override settings (experimental)
See [available settings](https://github.com/mifi/lossless-cut/blob/master/public/configStore.js). Note that this is subject to change in newer versions. ⚠️ If you specify incorrect values it could corrupt your configuration file. You may use JSON or JSON5:
```bash
LosslessCut --settings-json '{captureFormat:"jpeg", "keyframeCut":true}'
```

## Developing

See the [developer notes](developer-notes.md).

## Donate 🙈

This project is maintained by me alone. The project will always remain free and open source, but if it's useful for you, consider supporting me. :) It will give me extra motivation to improve it. Or even better [donate to ffmpeg](https://www.ffmpeg.org/donations.html) because they are doing the world a big favor 🙏

[Paypal](https://paypal.me/mifino/usd) | [crypto](https://mifi.no/thanks)

## Articles

- [Featured in the Console newsletter](https://console.substack.com/p/console-93)

## Attributions
- App icon made by [Dimi Kazak](http://www.flaticon.com/authors/dimi-kazak "Dimi Kazak") from [www.flaticon.com](http://www.flaticon.com "Flaticon") is licensed by [CC 3.0 BY](http://creativecommons.org/licenses/by/3.0/ "Creative Commons BY 3.0")
- [Lottie animation](https://lottiefiles.com/7077-magic-flow)
- Thanks to Adi Abinun for his UI sketch work, inspiration and guidance
- [Thanks to everyone for supporting](https://mifi.no/thanks/) my open source work 🙌
- Thanks to translators who helped translate the app. [You can too!](https://hosted.weblate.org/projects/losslesscut/losslesscut/)

## More software

- I made a command line video editor with slick transitions and lots of colors! [editly](https://github.com/mifi/editly)
- I made a tool for cross platform sharing of files between computer/phone over the local network: [ezshare](https://github.com/mifi/ezshare)
- I created a super simple Instagram bot for getting more followers [SimpleInstaBot](https://github.com/mifi/SimpleInstaBot)

---

Made with ❤️ in [🇳🇴](https://www.youtube.com/watch?v=uQIv8Vo9_Jc)

[More apps by mifi.no](https://mifi.no/)

Follow me on [GitHub](https://github.com/mifi/), [YouTube](https://www.youtube.com/channel/UC6XlvVH63g0H54HSJubURQA), [IG](https://www.instagram.com/mifi.no/), [Twitter](https://twitter.com/mifi_no) for more awesome content!
