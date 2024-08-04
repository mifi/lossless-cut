# FAQ

- **Can LosslessCut crop, resize, stretch, mirror, overlay text/images, watermark, blur, redact, re-encode, create GIF, slideshow, burn subtitles, color grading, fade/transition between video clips, fade/combine/mix/merge audio tracks or change audio volume?**
  - No, these are all lossy operations (meaning you *have* to re-encode the file), but in the future I may start to implement such features. [See this issue for more information.](https://github.com/mifi/lossless-cut/issues/372). See also [#643](https://github.com/mifi/lossless-cut/issues/643).
- Can LosslessCut be batched/automated using a CLI or API?
  - While it was never designed for advanced batching/automation, it does have a [basic CLI and a HTTP API](./cli.md), and there are a few feature requests regarding this: [#980](https://github.com/mifi/lossless-cut/issues/980) [#868](https://github.com/mifi/lossless-cut/issues/868).
- Is there a keyboard shortcut to do X?
  - First check the Keyboard shortcuts dialog. If you cannot find your shortcut there, [see this issue.](https://github.com/mifi/lossless-cut/issues/254)
- When will you implement feature X?
  - I have limited time and I have a lot of projects to work on, so I cannot promise any timeline. I will usually prioritize the issues with the most likes, [see here for a list of the most popular issues](https://github.com/mifi/lossless-cut/issues/691).
- How to *cut away* a middle part of a video?
  - Enable "advanced view" and then click the Yin Yang symbol. It will invert the segments.
- Where is application data, settings and temp files stored?
  - Electron's [appData](https://www.electronjs.org/docs/api/app#appgetpathname) folder: `%APPDATA%/LosslessCut` on Windows. `~/Library/Application Support/LosslessCut` on macOS. `$XDG_CONFIG_HOME/LosslessCut` or `~/.config/LosslessCut` on Linux. See also [portable app?](https://github.com/mifi/lossless-cut/issues/645)
- Can I export and replace the input file in-place?
  - No, but you can export and automatically delete the input file.
- Can you publish through [winget](https://github.com/mifi/lossless-cut/issues/1279), [Flatpak](https://github.com/mifi/lossless-cut/pull/1813), [Docker](https://github.com/mifi/lossless-cut/issues/1086) or other software mangers?
  - In general I don't want to maintain more build systems, but I could be open to linking to externally maintained build systems.

## App Stores and GitHub difference

LosslessCut version in the App Stores is often a few versions behind the latest GitHub version, because I want to be sure that the new versions work perfectly before releasing in the App Stores. The GitHub version will contain new, untested features and may contain some bugs (even in existing functionality). I consider the newest GitHub versions to be a public "beta" test. Then, once I'm sure that the new version works well, I will release it in the App Stores as well to give a frictionless as possible experience for customers.

### Feature differences

They have exactly the same in-app features, except for a few platform limitations: Apple doesn't allow opening VOB files with App Store apps. Apple App Store apps run in a sandbox, and therefore need to prompt for output directory before allowing writing files.

# Primer: Video & audio formats vs. codecs

Here's a little primer about video and audio formats for those not familiar. A common mistake when dealing with audio and video files, is to confuse *formats*, *codecs*, and *file names*. In short: A file's media format is a *container* that holds one or more *codecs* (audio/video/subtitle) inside of it. For example `.mov` is a *container format*, and `H265`/`HEVC` is a *codec*. Some formats support some particular codecs inside of them, while others support other codecs. The most common formats are arguably Matroska (often `.mkv`) and MP4/MOV (often `.mp4`/`.mov`) as well as their derivatives. Example: If you have a file named `My video.mp4`, this file most likely (but not necessarily) has the *format* `MP4`. Note that the extension of a file (in this case `.mp4`) doesn't really mean anything, and the file could in reality for example have the `MOV` format, or the extension could be `.txt`. Inside `My video.mp4` there are multiple tracks/streams, each with their own *codec*. In this example, let's say that it contains one `H264` track and one `AAC` track. In LosslessCut you can view and add/delete/modify these tracks.

**Remuxing**: If you change the output format in LosslessCut and export a file, you are *remuxing* the tracks/codecs into a different container format. When you do this, the operation is in theory lossless, meaning you will not lose any codec data and the different tracks will remain exactly the same, even though the format is now different (but some format metadata might get lost due to incompatibilities between container formats). There are limitations: Some popular codecs like VP8 or VP9 are not supported in popular formats like MP4, and some popular formats like Matroska (`.mkv`) are not natively supported in popular video players like iPhone or QuickTime.

Here is a great introduction to audio/video: [howvideo.works](https://howvideo.works/).

# Common / known issues & troubleshooting

## The exported video has a problem

If the video exports successfully without any error from LosslessCut, but it does not look as expected when playing back, please try this:

- Try both `Keyframe cut` vs `Normal cut` (do not use `Smart Cut` if you have any problem)
- Disable unnecessary tracks from the **Tracks panel**. First try to disable all tracks except the main track (e.g. video) and if that succeeds, then work your way by enabling more tracks and see which one is causing the problem. Sometimes LosslessCut (ffmpeg) is unable to cut certain tracks at all, and this could lead to a strange output (e.g. wrong output duration or black parts).
- Select a different **output format** (`matroska` and `mov` support a lot of codecs.)
- Try the same operation with a different file (same codec or different codec) and see whether it's a problem with just that one particular file.
- Enable the **Experimental Flag** under **Settings** before trying again.

## Cutting times are not accurate

Each segment's *start cut time* normally (but not always) will be "rounded" to the nearest **previous** keyframe. This means that you often have to move the **start cut time** to **few frames after** the desired keyframe.
- Lossless cutting is not an exact science. For some files, it just works. For others, you may need to trial and error to get the best cut. See [#330](https://github.com/mifi/lossless-cut/issues/330)
- Your mileage may vary when it comes to `Keyframe cut` vs `Normal cut`. Most common video files need `Keyframe cut`, but you may need to try both. [ffmpeg](https://trac.ffmpeg.org/wiki/Seeking) also has documentation about these two seek/cut modes. In `ffmpeg`, `Keyframe cut` corresponds to `-ss` *before* `-i` and `Normal cut` is `-ss` *after* `-i`.
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
1. First open each file separately and just export without cutting anything
  - Changing format to `mp4` is [known to fix certain issues like `Non-monotonous DTS in output stream`](https://github.com/mifi/lossless-cut/issues/1713#issuecomment-1726325218)
  - If you're seeing incorrect output duration, sped up or slowed down segments, then changing format to TS is [known to give the files a common timebase](https://github.com/mifi/lossless-cut/issues/455), which sometimes makes it possible to merge them.
3. Then merge the exported files.

Doing this first might "clean up" certain parameters in the files, to make them more compatible for merging. If this doesn't work, you can also try to change `avoid_negative_ts` (in export options). Also try to disable most tracks (see above).

## Smart cut not working

Smart cut is experimental, so don't expect too much. But if you're having problems, check out [this issue](https://github.com/mifi/lossless-cut/issues/126). If Smart Cut gives you repeated (duplicate) segments, you can try to enable the Export Option "Shift all start times".

## My file changes from MP4 to MOV

Some MP4 files ffmpeg is not able to export as MP4 and therefore needs to use MOV instead. Unfortunately I don't know any way to fix this.

## Output file name is missing characters

If the output file name has special characters that get replaced by underscore (`_`), try to turn off ["Sanitize"](https://github.com/mifi/lossless-cut/issues/889) in the "Output file names" editor in the "Export options" dialog. Note that this will cause special characters like `/` to be preserved. Some characters are not supported in some operating systems, so be careful. using `/` or `\` can be used to create a folder structure from your segments when exported.

## Linux specific issues

- If you get an error like `FATAL:setuid_sandbox_host.cc(157)] The SUID sandbox helper binary was found, but is not configured correctly. Rather than run without sandboxing I'm aborting now.`, try to run it as `./lossless-cut --no-sandbox`. See [#258](https://github.com/mifi/lossless-cut/issues/258)

## Windows specific issues

- I get an error/crash immediately when starting up LosslessCut
  - Try to disable your anti-virus or whitelist LosslessCut. See [#18](https://github.com/mifi/lossless-cut/issues/18) [#1114](https://github.com/mifi/lossless-cut/issues/1114)
- Completely white window when starting up?
  - Try to run with `--disable-gpu` - See [781](https://github.com/mifi/lossless-cut/issues/781).
- How to uninstall LosslessCut?
  - There is no installer. Just delete the folder. Settings and temp files are stored in your [appData](https://www.electronjs.org/docs/api/app#appgetpathname) folder.
- Preview of H265/HEVC files is completely black or corrupted?
  - Go to settings and disable "Hardware HEVC decoding".
- Video preview playback slow or stuttering inside LosslessCut?
  - See [#922](https://github.com/mifi/lossless-cut/issues/922) [#1904](https://github.com/mifi/lossless-cut/issues/1904) [#1915](https://github.com/mifi/lossless-cut/issues/1915) [#922](https://github.com/mifi/lossless-cut/issues/922)
- Where did the `.exe`/`.zip` downloads go?
  - I decided to stop distributing exe and instead just 7zip, due to the [problems that the exe download was causing and the large size of zips.](https://github.com/mifi/lossless-cut/issues/1072#issuecomment-1066026323).
- [APPX is not signed and **does not work**.](https://github.com/mifi/lossless-cut/issues/337) Please use [7z package](https://github.com/mifi/lossless-cut/releases/latest/download/LosslessCut-win-x64.7z) instead.
- I'm getting a KERNEL32.dll error
  - It's probably because you're running Windows 7, 8 or 8.1 which are [no longer supported.](https://github.com/mifi/lossless-cut/discussions/1476)

# Known limitations

## Low quality / blurry playback

Some formats or codecs are not natively supported, so they will play back with a lower quality. You may convert these files to a supported codec from the File menu, see [#88](https://github.com/mifi/lossless-cut/issues/88).

## MPEG TS / MTS

MPEG TS (`.mts`/`.ts`) files have a tendency to be a [bit problematic](https://github.com/mifi/lossless-cut/issues/1839). It may help to **first** remux them to another format like MP4/MKV. Then you can open the MP4/MKV file an work on that. Also disable non-needed tracks. In LosslessCut you can remux files by simply opening them, select a different output format, and export without editing the timeline (segments).

## EXIF / metadata

EXIF/metadata can be preserved (see Export Options dialog), but it doesn't always output compliant files, so use it carefully. Alternatively you can use [exiftool](https://exiftool.org/) after exporting with LosslessCut to transfer metadata, for example:

```bash
exiftool -tagsFromFile original-source-file.mp4 -all:all -overwrite_original exported-from-losslesscut.mp4
```

More info [#1027](https://github.com/mifi/lossless-cut/issues/1027)

## Proprietary data tracks list

When exporting, LosslessCut may be unable to process certain proprietary tracks. For example `tmcd`, `fdsc` and `gpmd` added by GoPro. These can however be losslessly exported to separate files if you want to keep this data for later.

## Multiple LosslessCut instances

By default, only a single running instance of LosslessCut is allowed. If you start a new LosslessCut instance from the command line, it will instead pass the list of files onto the already running instance. You can override this behavior inside settings Note that this is **(experimental)**, because Electron doesn't seem to support this. [More info](https://github.com/electron/electron/issues/2493) [#1641](https://github.com/mifi/lossless-cut/issues/1641)

## Rotation and merging

A video’s rotation is just metadata stored in its file. A file can only have a single rotation across the whole file, so if you have two video files and you rotate only one file and then concatenate them, there will be only one output rotation.

# Still cannot find an answer?

If any other problem please search for [existing issues](https://github.com/mifi/lossless-cut/issues) before you [ask a question](https://github.com/mifi/lossless-cut/discussions) here on GitHub. You can check the developer tools for any errors or clues. Menu: `Tools` -> `Toggle Developer Tools`.
Also you are welcome to hang out on [Discord](https://discord.gg/fhnEREfUJ3) 🤗
