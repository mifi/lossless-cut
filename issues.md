# FAQ

- **Can LosslessCut crop, resize, stretch, mirror, overlay text/images, watermark, blur, redact, re-encode, speed-up/slow-down, create GIF, slideshow, burn subtitles, color grading, fade/combine/mix/merge audio tracks or change audio volume?**
  - No, these are all lossy operations (meaning you have to re-encode the file), but in the future I may start to implement such features. [See this issue for more information.](https://github.com/mifi/lossless-cut/issues/372)
- Can LosslessCut be batched/automated using a CLI or API?
  - While it was never designed for advanced batching/automation, it does have a [basic CLI](./cli.md), and there are a few feature requests regarding this: [#980](https://github.com/mifi/lossless-cut/issues/980) [#868](https://github.com/mifi/lossless-cut/issues/868).
- Is there a keyboard shortcut to do X?
  - First check the Keyboard shortcuts dialog. If you cannot find your shortcut there, [see this issue.](https://github.com/mifi/lossless-cut/issues/254)
- When will you implement feature X?
  - I have limited time and I have a lot of projects to work on, so I cannot promise any timeline. I will usually prioritize the issues with the most likes, [see here for a list of the most popular issues](https://github.com/mifi/lossless-cut/issues/691).

## App Stores and GitHub difference

LosslessCut version in the App Stores is often a few versions behind the latest GitHub version, because I want to be sure that the new versions work perfectly before releasing in the App Stores. The GitHub version will contain new, untested features and may contain some bugs (even in existing functionality). I consider the newest GitHub versions to be a public "beta" test. Then, once I'm sure that the new version works well, I will release it in the App Stores as well to give a frictionless as possible experience for customers.

### Feature differences

They have exactly the same in-app features, except for a few platform limitations: Apple doesn't allow opening VOB files with App Store apps. Apple App Store apps run in a sandbox, and therefore need to prompt for output directory before allowing writing files.

# Common / known issues & troubleshooting

## The exported video has a problem

If the video exports successfully without any error from LosslessCut, but it does not look as expected when playing back, please try this:

- Try both `Keyframe cut` vs `Normal cut` (do not use `Smart Cut` if you have any problem)
- Disable unnecessary tracks from the **Tracks panel**. First try to disable all tracks except the main track (e.g. video) and if that succeeds, then work your way by enabling more tracks and see which one is causing the problem. Sometimes LosslessCut (ffmpeg) is unable to cut certain tracks at all.
- Select a different **output format** (`matroska` and `mov` support a lot of codecs.)
- Try to enable the **Experimental Flag** under **Settings**
- Try the same operation with a different file (same codec or different codec) and see whether it's a problem with just one particular file.

## Cutting times are not accurate

Start cut time will be "rounded" to the nearest **previous** keyframe. This means that you often have **move the start cut time to few frames after** the desired keyframe.
- Lossless cutting is not an exact science. For some files, it just works. For others, you may need to trial and error depending on the codec, keyframes etc to get the best cut. See [#330](https://github.com/mifi/lossless-cut/issues/330)
- Your mileage may vary when it comes to `Keyframe cut` vs `Normal cut`. You may need to try both, depending on the video. [ffmpeg](https://trac.ffmpeg.org/wiki/Seeking) also has documentation about these two seek/cut modes. `Keyframe cut` means `-ss` *before* `-i` and `Normal cut` means `-ss` *after* `-i`.
- If you're seeing a blank video at the beginning of the resulting file, try `Keyframe cut` instead.
- You may try to enable the new "Smart cut" mode to remedy this inaccuracy. However it is very experimental and may not work for most files.
- Try to set the **start**-cutpoint a few frames **before or after** the nearest keyframe (may also solve audio sync issues).
- Alternatively, try to change `avoid_negative_ts` (in export options).

## Cut file has same length as input

If you cut a file, but the duration of the exported file is the same as input file's duration, try to disable all tracks except for the video track and see if that helps. Sometimes a file contains some tracks that LosslessCut is unable to cut. It will then leave them as is, while cutting the other tracks. This may lead to incorrect output duration. Try also changing `avoid_negative_ts` (in export options).

If you are trying to cut a FLAC file but your output has the same duration as input, you might have run into [this ffmpeg issue](https://github.com/mifi/lossless-cut/discussions/1320).

## Merge / concat results in corrupt or broken parts

Try to change `avoid_negative_ts` (in export options). Also try to disable tracks (see above).

## Merge / concat results in incorrect duration, sped up or slowed down segments

This can happen when trying to merge files that are not compatible. Make sure they have the exact same codec parameters before merging. If you are sure they are the same, you can try to first running each of the files separately through LosslessCut before merging the outputs:
1. First open each file separately and just export without cutting anything.
2. Merge the exported files.

This might "clean up" certain parameters in the files, to make them more compatible for merging. In particular it could give them the same timebase, which is known to help. Changing format (remuxing) to TS first is known to give the files a common timebase, which makes it possible to merge them. For more info see [#455](https://github.com/mifi/lossless-cut/issues/455).

## Smart cut not working

Smart cut is experimental, but if you're having problems, check out [this issue](https://github.com/mifi/lossless-cut/issues/126).

## My file changes from MP4 to MOV

Some MP4 files ffmpeg is not able to export as MP4 and therefore needs to use MOV instead. Unfortunately I don't know any way to fix this.

## Linux specific issues

- If you get an error like `FATAL:setuid_sandbox_host.cc(157)] The SUID sandbox helper binary was found, but is not configured correctly. Rather than run without sandboxing I'm aborting now.`, try to run it as `./lossless-cut --no-sandbox`. See [#258](https://github.com/mifi/lossless-cut/issues/258)

## Windows specific issues

- If you get an error immediately when starting up LosslessCut, try to disable your anti-virus or whitelist LosslessCut. See [#18](https://github.com/mifi/lossless-cut/issues/18) [#1114](https://github.com/mifi/lossless-cut/issues/1114)
- How to uninstall LosslessCut? There is no installer. Just delete the folder. Settings and temp files are stored in your [appData](https://www.electronjs.org/docs/api/app#appgetpathname) folder.
- Completely white window when starting up? Try to run with `--disable-gpu` - See [781](https://github.com/mifi/lossless-cut/issues/781).
- Preview of H265/HEVC files is completely black or corrupted? Go to settings and disable "Hardware HEVC decoding" 
- Where did the `.exe`/`.zip` downloads go? I decided to stop distributing exe and instead just 7zip, due to the [problems that the exe download was causing and the large size of zips.](https://github.com/mifi/lossless-cut/issues/1072#issuecomment-1066026323)
- [APPX is not signed and **does not work**.](https://github.com/mifi/lossless-cut/issues/337) Please use [7z package](https://github.com/mifi/lossless-cut/releases/latest/download/LosslessCut-win-x64.7z) instead.

# Known limitations

## Low quality / blurry playback and no audio

Some codecs are not natively supported, so they will preview with low quality playback and no audio. You may convert these files to a supported codec from the File menu, see [#88](https://github.com/mifi/lossless-cut/issues/88).

## MPEG TS / MTS

MPEG TS (`.mts`/`.ts`) files have a tendency to be a bit problematic. It may help to **first** remux them to another format like MP4/MKV. Then you can open the MP4/MKV file an work on that. Also disable non-needed tracks.

## EXIF / metadata

EXIF/metadata can be preserved (see Export Options dialog), but it doesn't always output compliant files, so use it carefully.

## When exporting you may lose some proprietary data tracks

For example `tmcd`, `fdsc` and `gpmd` added by GoPro. These can however be losslessly exported to separate files if you want to keep this data for later.

## Multiple LosslessCut instances

By default, only a single running instance of LosslessCut is allowed. If you start a new LosslessCut instance from the command line, it will instead pass the list of files onto the already running instance. You can override this behavior inside settings **(experimental)**.

# Still cannot find an answer?

If any other problem please search for [existing issues](https://github.com/mifi/lossless-cut/issues) before you file an issue here on GitHub. You can check the developer tools for any errors or clues. Menu: `Tools` -> `Toggle Developer Tools`.
Also you are welcome to hang out on [Discord](https://discord.gg/fhnEREfUJ3) 🤗
