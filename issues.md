# FAQ

- **Can LosslessCut crop, resize, stretch, mirror, overlay text/images, watermark, blur, redact, re-encode, speed-up/slow-down, create GIF, slideshow, burn subtitles, color grading, fade/combine/mix/merge audio tracks or change audio volume?**
  - No, these are all lossy operations (meaning you have to re-encode the file), but in the future I may start to implement such features. [See this issue for more information.](https://github.com/mifi/lossless-cut/issues/372)
- Can LosslessCut be batched/automated using a CLI or API?
  - While it was never designed for advanced batching/automation, it does have a [basic CLI](./cli.md), and there are a few feature requests regarding this: [#980](https://github.com/mifi/lossless-cut/issues/980) [#868](https://github.com/mifi/lossless-cut/issues/868).
- Is there a keyboard shortcut to do X?
  - [See this issue.](https://github.com/mifi/lossless-cut/issues/254)
- When will you implement feature X?
  - I have limited time and I have a lot of projects to work on, so I cannot promise any timeline. I will usually prioritize the issues with the most likes, [see here for a list of the most popular issues](https://github.com/mifi/lossless-cut/issues/691).

# Common / known issues & troubleshooting

## Cutting times are not accurate

Start cut time will be "rounded" to the nearest **previous** keyframe. This means that you often have **move the start cut time to few frames after** the desired keyframe.
  - Lossless cutting is not an exact science. For some files, it just works. For others, you may need to trial and error depending on the codec, keyframes etc to get the best cut. See [#330](https://github.com/mifi/lossless-cut/issues/330)
  - Your mileage may vary when it comes to `Keyframe cut` vs `Normal cut`. You may need to try both, depending on the video. [ffmpeg](https://trac.ffmpeg.org/wiki/Seeking) also has documentation about these two seek/cut modes. `Keyframe cut` means `-ss` *before* `-i` and `Normal cut` means `-ss` *after* `-i`.
  - If you're seeing a blank video at the beginning of the resulting file, try `Keyframe cut` instead.
  - You may try to enable the new "Smart cut" mode. However it is very experimental and may not work for most files.

## Cut file has same length as input

If you cut a file, but the duration of the exported file is the same as input file's duration, try to disable all tracks except for the video track and see if that helps. Sometimes a file contains some tracks that LosslessCut is unable to cut. It will then leave them as is, while cutting the other tracks. This may lead to incorrect output duration.

## Merge / concat results in incorrect duration, sped up or slowed down segments

This might be caused by trying to merge files that are not compatible. Make sure they have the exact same codec parameters before merging. If you are sure they are the same, you can try to running each of the files through LosslessCut before merging them. By "running them through LosslessCut" I mean open each file and just export without cutting, and then merge each of the exported files. This might "clean up" certain parameters in the files, to make them more compatible for merging. In particular it might give them the same timebase, which is known to help. For more info see [#455](https://github.com/mifi/lossless-cut/issues/455).

## Smart cut not working

Smart cut is experimental, but if you're having problems, check out [this issue](https://github.com/mifi/lossless-cut/issues/126).

## Linux specific issues

- If you get an error like `FATAL:setuid_sandbox_host.cc(157)] The SUID sandbox helper binary was found, but is not configured correctly. Rather than run without sandboxing I'm aborting now.`, try to run it as `./lossless-cut --no-sandbox`. See [#258](https://github.com/mifi/lossless-cut/issues/258)

## Windows specific issues

- If you get an error immediately when starting up LosslessCut, try to disable your anti-virus or whitelist LosslessCut. See [#18](https://github.com/mifi/lossless-cut/issues/18) [#1114](https://github.com/mifi/lossless-cut/issues/1114)
- How to uninstall LosslessCut? There is no installer. Just delete the folder. Settings and temp files are stored in your [appData](https://www.electronjs.org/docs/api/app#appgetpathname) folder.
- Completely white window when starting up? Try to run with `--disable-gpu` - See [781](https://github.com/mifi/lossless-cut/issues/781).
- Where did the `.exe`/`.zip` downloads go? I decided to stop distributing exe and instead just 7zip, due to the [problems that the exe download was causing and the large size of zips.](https://github.com/mifi/lossless-cut/issues/1072#issuecomment-1066026323)
- [APPX is not signed and **does not work**.](https://github.com/mifi/lossless-cut/issues/337) Please use [7z package](https://github.com/mifi/lossless-cut/releases/latest/download/LosslessCut-win-x64.7z) instead.

# Limitations

## Low quality playback

Some codecs are not natively supported, so they will preview with low quality playback and no audio. You may convert these files to a supported codec from the File menu, see [#88](https://github.com/mifi/lossless-cut/issues/88).

## MPEG TS / MTS

MPEG TS (`.mts`/`.ts`) files have a tendency to be a bit problematic. It may help to **first** remux them to another format like MP4/MKV. Then you can open the MP4/MKV file an work on that.

## EXIF / metadata

EXIF/metadata can be preserved (see Export Options dialog), but it doesn't always output compliant files, so use it carefully.

## When exporting you may lose some proprietary data tracks

For example `tmcd`, `fdsc` and `gpmd` added by GoPro. These can however be losslessly exported to separate files if you want to keep this data for later.

# Still cannot find an answer?

If any other problem please search for [existing issues](https://github.com/mifi/lossless-cut/issues) before you file an issue here on GitHub. You can check the developer tools for any errors or clues. Menu: `Tools` -> `Toggle Developer Tools`.
Also you are welcome to hang out on [Discord](https://discord.gg/fhnEREfUJ3) 🤗
