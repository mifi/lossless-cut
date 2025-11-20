# FAQ

Please read this first:

- **Q:** Can LosslessCut **crop, resize, stretch, mirror/flip, overlay text/images, watermark, blur, redact, reduce quality/re-encode, create GIF, slideshow, burn subtitles, color grading, fade/transition between video clips, fade/combine/mix/merge audio tracks, mute audio channels or change audio volume**?
  - **A:** No, these are all lossy operations (meaning you *have* to re-encode the file), but in the future I may start to implement such features. [See #372](https://github.com/mifi/lossless-cut/issues/372). Related: [#643](https://github.com/mifi/lossless-cut/issues/643).
- **Q:** Is there a keyboard shortcut to do X?
  - **A:** First check the Keyboard shortcuts dialog. If you cannot find your shortcut there, [see this issue.](https://github.com/mifi/lossless-cut/issues/254)
- **Q:** Can LosslessCut do the same batch conversion operation on multiple files?
  - [**A:** Probably not, but you can probably do it! See here.](./batch.md)
- **Q:** Can LosslessCut be automated using a CLI or API or do external post-processing?
  - **A:** While it was never designed for advanced batching/automation, it does have a [basic CLI and a HTTP API](./cli.md). More info: [#980](https://github.com/mifi/lossless-cut/issues/980) [#868](https://github.com/mifi/lossless-cut/issues/868).
- **Q:** How to *cut away* a middle part of a video?
  - **A:** Enable "advanced view" and then click the Yin Yang symbol. It will invert the segments.
- **Q:** When will you implement feature X?
  - **A:** I have limited time and I have a lot of projects to work on, so I cannot promise any timeline. I will usually prioritize the issues with the most likes, [see here for a list of the most popular issues](https://github.com/mifi/lossless-cut/issues/691).
- **Q:** Is LosslessCut a portable app? Where is application data, settings and temp files stored?
  - **A:** See LosslessCut is *not* a [portable app](https://github.com/mifi/lossless-cut/issues/645). See [Installation and files](./installation.md).
- **Q:** Can I export and replace the input file in-place?
  - **A:** No, but you can export and automatically delete the input file.
- **Q:** Can you publish through [winget](https://github.com/mifi/lossless-cut/issues/1279), [Flatpak](https://github.com/mifi/lossless-cut/pull/1813), [Docker](https://github.com/mifi/lossless-cut/issues/1086) or other software mangers?
  - **A:** In general I don't want to maintain more build systems, but I could be open to linking to externally maintained build systems.
- **Q:** How to sync/shift audio/video tracks?
  - **A:** This is not natively supported but it can be done with a workaround, see [#216](https://github.com/mifi/lossless-cut/issues/216).

## App Stores and GitHub difference

LosslessCut version in the App Stores is often a few versions behind the latest GitHub version, because I want to be sure that the new versions work perfectly before releasing in the App Stores. The GitHub version will contain new, untested features and may contain some bugs (even in existing functionality). I consider the newest GitHub versions to be a public "beta" test. Then, once I'm sure that the new version works well, I will release it in the App Stores as well to give a frictionless as possible experience for customers. They have exactly the same in-app features, except for a few platform limitations: Apple doesn't allow opening VOB files with App Store apps. Apple App Store apps run in a sandbox, and therefore need to prompt for output directory before allowing writing files.

# Primer: Video & audio formats vs. codecs

Learn the [difference between a codec and a format](docs.md#primer-video--audio-formats-vs-codecs).

# Common / known issues & troubleshooting

## The exported video has a problem

If the video exports successfully without any error from LosslessCut, but it does not look as expected when playing back, please try this:

- Try both with *Keyframe cut mode* on and off (do not use `Smart Cut` if you have any problem).
- Disable unnecessary tracks from the **Tracks panel**. First try to disable all tracks except the main track (e.g. video) and if that succeeds, then work your way by enabling more tracks and see which one is causing the problem. Sometimes LosslessCut (ffmpeg) is unable to cut certain tracks at all, and this could lead to a strange output (e.g. wrong output duration or black parts).
- Select a different **output format** (`matroska` and `mov` support a lot of codecs.)
- Try the same operation with a different file (same codec or different codec) and see whether it's a problem with just that one particular file.
- Enable the **Experimental Flag** under **Settings** before trying again.

## Cutting times are not accurate

Each segment's *start cut time* normally (but not always) will be "rounded" to the nearest **previous** keyframe. This means that you often have to move the **start cut time** to **few frames after** the desired keyframe.
- Lossless cutting is not an exact science. For some files, it just works. For others, you may need to trial and error to get the best cut. See [#330](https://github.com/mifi/lossless-cut/issues/330)
- Your mileage may vary when it comes to *Keyframe cut mode*. Most common video files need *Keyframe cut* enabled, but you may need to try both values. [ffmpeg](https://trac.ffmpeg.org/wiki/Seeking) also has documentation about these two seek/cut modes. In `ffmpeg`, *Keyframe cut* corresponds to `-ss` *before* `-i`.
- Try to change `avoid_negative_ts` (in export options).
- Try also to set the **start**-cutpoint a few frames **before or after** the nearest keyframe (may also solve audio sync issues).
- You may try to enable the new "Smart cut" mode to allow cutting between keyframes. However it is very experimental and may not work for many files.
- Currently, the only way to review the exported file (to check the actual cutpoints) is to run the export (possibly with only one segment enabled to speed up) and then manually check the output file. See also [#1887](https://github.com/mifi/lossless-cut/issues/1887)

### Starts from wrong keyframe

For some files, when you place segment start cutpoints at keyframes, and you export, it will instead cut from the keyframe **before** the keyframe that you wanted. This is because with some videos, ffmpeg struggles to find the nearest previous keyframe, see [#1216](https://github.com/mifi/lossless-cut/issues/1216). To workaround this, you can try to shift your segments' **start**-cutpoints forward by a few frames, so that ffmpeg correctly cuts from the *previous* keyframe. You can also enable the Export Option "Shift all start times" by +1, +2, +3 frames or so.

- Menu: "Edit" -> "Segments" -> "Shift all segments on timeline"
- Enter `00:00:00.200` (or a larger value if it doesn't help)
- When asked about Start or End timestamps, Select **Start**

This will effectively shift all start times of segments by 6 frames (`6/30=0.2` for 30fps video).

## Cut file has same length as input

If you cut a file, but the duration of the exported file is the same as input file's duration, try to disable all tracks except for the video track and see if that helps. Sometimes a file contains some tracks that LosslessCut is unable to cut. It will then leave them as is, while cutting the other tracks. This may lead to incorrect output duration. Try also changing `avoid_negative_ts` (in export options).

If you are trying to cut a FLAC file but your output has the same duration as input, you might have run into [this ffmpeg limitation](https://github.com/mifi/lossless-cut/discussions/1320).

## Merge / concat results in corrupt or broken parts

This can happen when trying to merge files that are not compatible. Make sure they have the exact same codec parameters before merging. If you are sure they are the same, you can try to first running each of the files separately through LosslessCut before merging the outputs:
1. First open each file separately and just export without cutting anything, but before exporting
  - change the format to `mp4` is [known to fix certain issues like `Non-monotonous DTS in output stream`](https://github.com/mifi/lossless-cut/issues/1713#issuecomment-1726325218)
  - change the format to TS (`mpegts`) is [known to give the files a common timebase](https://github.com/mifi/lossless-cut/issues/455), which sometimes makes it possible to merge them, or fixes incorrect output duration, sped up or slowed down segments.
3. Then merge the resulting exported files.

Doing this first might "clean up" certain parameters in the files, to make them more compatible for merging. If this doesn't work, you can also try to change `avoid_negative_ts` (in export options). Also try to disable most tracks (see above). If this doesn't resolve the issue, then it probably means that you're hitting a bug or limitation in FFmpeg with the particular file that you're cutting/merging. Unfortunately there's not much to do other than trying different output settings, different cut time or waiting for improvements in FFmpeg.

## Smart cut not working

Smart cut is experimental, so don't expect too much. But if you're having problems, check out [this issue](https://github.com/mifi/lossless-cut/issues/126).
- If Smart cut gives you repeated (duplicate) segments, you can try to enable the Export Option "Shift all start times".
- Sometimes it helps to convert (remux) your videos [to mp4 first](https://github.com/mifi/lossless-cut/discussions/1292#discussioncomment-10425084) (e.g. from mkv) using LosslessCut, before smart cutting them.

## MP4/MOV extension

MP4 and MOV are technically almost the same format. Sometimes files have the extension `.mp4` but are in reality the MOV format (and vice versa). MOV tends to be more lenient in which codecs it supports. FFmpeg has problems exporting some MP4 files as MP4, so MOV needs to be selected instead. Unfortunately I don't know any way to fix this. Sometimes certain players are not able to play back certain exported `.mov` files ([Adobe Premiere](https://github.com/mifi/lossless-cut/issues/1075#issuecomment-2327459890) 👀). You can try to rename the exported MOV file extension to `.mp4` and see if it helps. Or vice versa, rename an exported MP4 file to `.mov`.

## MP4/MOV playback exported file fails

If you cannot playback the output video file even when exporting without doing any cuts at all, this might be due to FFmpeg applying the wrong output video codec tag (`hev1` vs `hvc1`). You can try to set the export option "Fix video codec tag / ID" to "Auto" or "Always". See [#2518](https://github.com/mifi/lossless-cut/issues/2518) [#1444](https://github.com/mifi/lossless-cut/issues/1444) [#2626](https://github.com/mifi/lossless-cut/issues/2626)

## Output file name is missing characters (Chinese, accents etc)

If the output file name has special characters that get replaced by underscore (`_`), try to turn off ["Sanitize"](https://github.com/mifi/lossless-cut/issues/889) in the "Output file names" editor in the "Export options" dialog. Note that this will cause special characters like `/` to be preserved. Some characters are not supported in some operating systems, so be careful. using `/` or `\` can be used to create a folder structure from your segments when exported.

## Linux specific issues

- If the app crashes on startup or you get an error like `FATAL:setuid_sandbox_host.cc(157)] The SUID sandbox helper binary was found, but is not configured correctly...`, try to run it as `./lossless-cut --no-sandbox`. See [#258](https://github.com/mifi/lossless-cut/issues/258) and [#2614](https://github.com/mifi/lossless-cut/issues/2614)
- [Hardware accelerated HEVC playback](https://github.com/mifi/lossless-cut/discussions/2261)

If you have an issue with the Snap or Flatpak version of LosslessCut, try instead the GitHub downloads. I **cannot provide support for the [Flatpak version](https://github.com/flathub/no.mifi.losslesscut)** because is not maintained by me.

## Windows specific issues

- I get an error/crash or completely white/blank LosslessCut window immediately after app launch
  - Try not to move the LosslessCut folder after installation. Make sure you run LosslessCut from `C:` drive (not network drive or similar) [#2215](https://github.com/mifi/lossless-cut/issues/2215#issuecomment-2925706575) [#2215](https://github.com/mifi/lossless-cut/issues/2215).
  - Make sure LosslessCut folder is **not** inside a folder hierarchy that contains special characters (like Chinese or Japanese or emoji ⚠️).
  - Try to run LosslessCut from the [command line](./cli.md) with `--disable-gpu` and/or `--disable-features=VizDisplayCompositor` (see [#781](https://github.com/mifi/lossless-cut/issues/781))
  - Try [removing the AppContainer restrictions](https://github.com/mifi/lossless-cut/discussions/2043#discussioncomment-14909957) on LosslessCut.
  - Disable your anti-virus or whitelist LosslessCut. See [#18](https://github.com/mifi/lossless-cut/issues/18), [#1114](https://github.com/mifi/lossless-cut/issues/1114). 

- How to uninstall LosslessCut?
  - There is no installer. Just delete the folder. [More info](./installation.md).
- Preview is completely black/blank, corrupted or just won't play back?
  - This probably means that Chromium (which LosslessCut uses for playback) doesn't support your particular file (maybe it's 10-bit). [#2228](https://github.com/mifi/lossless-cut/discussions/2228), [#1767](https://github.com/mifi/lossless-cut/discussions/1767), [#2307](https://github.com/mifi/lossless-cut/issues/2307).
  1. If H265/HEVC file, go to settings and disable "Hardware HEVC decoding".
  2. Use FFmpeg-assisted software decoding playback by going to *File* -> *Convert to supported format*
- Video preview playback slow, stuttering, low FPS, flickering (NVIDIA)
  - See [#922](https://github.com/mifi/lossless-cut/issues/922) [#1904](https://github.com/mifi/lossless-cut/issues/1904) [#1915](https://github.com/mifi/lossless-cut/issues/1915) [#922](https://github.com/mifi/lossless-cut/issues/922) [#2083](https://github.com/mifi/lossless-cut/issues/2083) [#2556](https://github.com/mifi/lossless-cut/issues/2556)
- Why no `.exe`/`.zip`/`.appx` downloads?
  - I decided to stop distributing exe/zip and instead just [7zip](https://github.com/mifi/lossless-cut/releases/latest/download/LosslessCut-win-x64.7z), due to the [problems](https://github.com/mifi/lossless-cut/issues/1072#issuecomment-1066026323) that the (self-extracting) exe was causing and the large size of `.zip` files. `appx` is unsigned and [**does not work**](https://github.com/mifi/lossless-cut/issues/337).
- I'm getting a `KERNEL32.dll` error
  - It's probably because you're running Windows 7, 8 or 8.1 which is [no longer supported.](https://github.com/mifi/lossless-cut/discussions/1476)

# Known limitations

- Undo/redo segments doesn't work through the top menu. This is a [known issue](https://github.com/mifi/lossless-cut/issues/610) that I don't know how to fix. Please use the keyboard shortcuts instead (<kbd>CTRL</kbd>/<kbd>CMD</kbd>+<kbd>Z</kbd> and <kbd>CTRL</kbd>+<kbd>Y</kbd> / <kbd>CMD</kbd>+<kbd>SHIFT</kbd>+<kbd>Z</kbd>).

## File not supported

If you're getting a message saying that the file must be converted to a supported format, this means that LosslessCut's built-in player isn't able to play back that particular file. As a work-around LosslessCut has an FFmpeg-assisted software decoding playback which can be activated from the menu: *File -> Convert to supported format*.

## Low quality / blurry playback

Some formats or codecs are not natively supported by LosslessCut's built in player, and LosslessCut will automatically use FFmpeg-assisted software decoding to playback in a lower quality. For better playback you may convert these files to a different format from the menu: *File -> Convert to supported format*. Note that this will not affect the output from LosslessCut, it is only used for playback, see [#88](https://github.com/mifi/lossless-cut/issues/88).

## MPEG TS / MTS

MPEG TS (`.mts`/`.ts`) files have a tendency to be a [bit problematic](https://github.com/mifi/lossless-cut/issues/1839). It may help to **first** remux them to another format like MP4/MKV. Then you can open the MP4/MKV file an work on that. Also disable non-needed tracks. In LosslessCut you can remux files by simply opening them, select a different output format, and export without editing the timeline (segments).

## EXIF / metadata

It is a known problem that FFmpeg will not always preserve metadata correctly. More info [#1027](https://github.com/mifi/lossless-cut/issues/1027). Some metadata can be preserved (see Export Options dialog), but it doesn't always output compliant files, so use it carefully. Alternatively you can use [exiftool](https://exiftool.org/) after exporting with LosslessCut to transfer metadata, for example:

```bash
exiftool -tagsFromFile Original-Source-File.mp4 -all:all -overwrite_original Exported-From-LosslessCut.mp4
```

## Proprietary data tracks list

When exporting, LosslessCut may be unable to process certain proprietary tracks. For example `tmcd`, `fdsc` and `gpmd` added by GoPro. These can however be losslessly exported to separate files if you want to keep this data for later.

## Multiple LosslessCut instances

By default, only a single running instance of LosslessCut is allowed. If you start a new LosslessCut instance from the command line, it will pass the list of files to the already running instance. You can override this behavior inside settings. Note that running multiple instances is **experimental**, because Electron doesn't seem to support this. [More info](https://github.com/electron/electron/issues/2493) [#1641](https://github.com/mifi/lossless-cut/issues/1641)

## Rotation and merging

A video’s rotation is just metadata stored in its file. A file can only have a single rotation across the whole file, so if you have two video files and you rotate only one file and then concatenate them, there will be only one output rotation.

## Extract single track as format

When you use the Tracks panel to extract a single track as a file, e.g. a subtitle, a default format will be automatically chosen. For example for subtitle, it will output an `.mks`. If you want a different output format, you can instead disable all tracks except the single track you want to extract, then close the Tracks panel, the choose the output format, (e.g. `srt`) and then perform an export.

# Still cannot find an answer?

If any other problem please search for [existing issues](https://github.com/mifi/lossless-cut/issues) before you [ask a question](https://github.com/mifi/lossless-cut/discussions) here on GitHub. You can check the developer tools for any errors or clues. Menu: `Tools` -> `Toggle Developer Tools`.
Also you are welcome to hang out on [Discord](https://discord.gg/fhnEREfUJ3) 🤗
