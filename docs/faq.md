# FAQ

Frequently asked questions. See also [🤔 Troubleshooting](troubleshooting.md) and the [📝 Recipe cookbook](recipes.md).

## General

### Is LosslessCut free? What's the difference between the app store and GitHub versions?

LosslessCut is free and open source, and you can download it for free from [GitHub](https://github.com/mifi/lossless-cut/releases). The versions in the Mac App Store and Microsoft Store cost a little, which supports my work on LosslessCut. They're signed, so you don't get warnings when installing them, and they update automatically.

The app store versions are often a few versions behind the latest GitHub version, because I want to be sure that a new version works well before releasing it there. Consider the newest GitHub versions a public "beta". The app store and GitHub versions have the same features, except for a few platform limitations: Apple doesn't allow app store apps to open VOB files, and Mac App Store apps run in a sandbox, so they need to ask for an output folder before they can write files.

### Is LosslessCut safe?

Yes, if you get it from an [official source](#can-i-download-losslesscut-from-other-websites-or-package-managers). LosslessCut is open source, so anyone can read its code, and the GitHub releases are built from that code by GitHub Actions. The app store versions are also reviewed by Apple and Microsoft. The Windows version on GitHub isn't code signed, so Windows and antivirus software may warn about it. LosslessCut has no ads or tracking, see the [privacy policy](https://losslesscut.app/privacy-policy).

### Can I download LosslessCut from other websites or package managers?

Only the [official sources](../README.md#download) (losslesscut.app, GitHub and the app stores) are maintained by me. Downloading LosslessCut from other sources, such as other websites or package managers like WinGet or Homebrew, is entirely at your own risk, because they are not maintained or vetted by me. See also [Unofficial versions](installation.md#unofficial-versions).

### Which operating systems does it run on?

Windows 10 and 11, macOS 12 or newer, and Linux (x64 and arm64). See [Supported OS versions](requirements.md).

### How do I update LosslessCut?

The app store versions update automatically. The GitHub version checks for new versions when it starts (you can turn this off in the settings), and shows a *New version!* menu with a download link when there is one. Download it and replace the old version with it, your settings are kept.

### How does LosslessCut compare to other video editors?

LosslessCut only does what it can without re-encoding, which makes it very fast and keeps the original quality. Video editors like DaVinci Resolve, Premiere or Shotcut, and converters like HandBrake, re-encode the video, which is slow and loses some quality each time, but they can do much more, like effects, transitions or making the file smaller. See [Commonly requested features](#commonly-requested-features) and the [primer on codecs and formats](index.md#primer-videoaudio-codecs-vs-formats).

### Is LosslessCut a portable app? Where are settings and temporary files stored?

LosslessCut is *not* a [portable app](https://github.com/mifi/lossless-cut/issues/645). See [Installation and files](installation.md).

### What are all these `.llc` files that get created?

They save your segments, so that you can continue where you left off when you open the file again. You can turn them off in the settings. See also [#2115](https://github.com/mifi/lossless-cut/issues/2115).

## Using LosslessCut

### Is there a keyboard shortcut to do X?

First check the Keyboard shortcuts dialog. If you cannot find your shortcut there, [see this issue](https://github.com/mifi/lossless-cut/issues/254).

### I cannot find a particular button or function

Click the "advanced view" (baby icon) in the bottom left to enable additional functionality.

### How do I cut away a middle part of a video?

Click the Yin Yang symbol ("advanced view"). It will invert the segments.

### How can I import multiple files into my project and edit them together?

LosslessCut is not a [non-linear editor](https://github.com/mifi/lossless-cut/issues/976) (like Adobe Premiere) and it is not a linear editor (like Avidemux) - it is something in-between. You create segments on the timeline and the segments represent which portions of video will be exported. If you want more advanced workflows, you have to do it in multiple separate operations, see the recipe [Cut multiple files and merge them all](recipes.md#cut-multiple-files-and-merge-them-all).

### How do I change the default 10 second length of new segments?

The 10 second default end is only used in simple mode and cannot be changed. Instead, click "advanced view" (baby icon, bottom left). New segments are then created as [markers](index.md#markers) (without an end). Or move the playhead and press <kbd>I</kbd> / <kbd>O</kbd> to set the current segment's start / end there.

### How do I sync or shift audio/video tracks?

Since v3.69.0 you can shift all tracks of a file relative to the other files (e.g. an external audio file that you added): open the tracks dialog and set *Shift by seconds* for that file. For other cases, see the workaround in [#216](https://github.com/mifi/lossless-cut/issues/216).

### Where are settings and keyboard shortcuts stored, and how do I copy them to another computer?

See [Copy settings and keyboard shortcuts to another computer](installation.md#copy-settings-and-keyboard-shortcuts-to-another-computer).

### Can LosslessCut remember more choices, selections, settings?

Maybe, see [#371](https://github.com/mifi/lossless-cut/issues/371).

## Exporting and merging

### Where's the "Export options" dialog?

Click the icon next to the export button (bottom right, "advanced view") to toggle whether to show this dialog before each export.

### Why does my export (or *Merge cuts*) start a few seconds before my cut point?

Because lossless cuts start from the keyframe before the cut point. See [Export starts a few seconds before my cut point](troubleshooting.md#export-starts-a-few-seconds-before-my-cut-point).

### File not supported, black preview or playback stutters?

See [Preview / playback problems](troubleshooting.md#preview--playback-problems). The preview does not affect the exported file.

### Why does my merged file only play the first part, or have later parts with only audio or corrupt video?

The files must have identical codec parameters. See [Merge / concat results in corrupt or broken parts](troubleshooting.md#merge--concat-results-in-corrupt-or-broken-parts).

### How can I export all segments with the same label into their own file, or quickly select many segments?

See [Export segments with the same label into their own file](recipes.md#export-segments-with-the-same-label-into-their-own-file).

### Can I cut or merge multiple files in the same timeline?

No, and I'm not sure if this will ever be implemented. Editing multiple files will have to be done in multiple steps, see the recipe [Cut multiple files and merge them all](recipes.md#cut-multiple-files-and-merge-them-all). See also [#976](https://github.com/mifi/lossless-cut/issues/976).

### Can I overwrite the input file, or export and replace it in place?

No, overwriting the input file is not allowed by design, for [several reasons](https://github.com/mifi/lossless-cut/issues/2538#issuecomment-3476574283). But you can export and automatically delete the input file (see keyboard shortcuts). If you want the output file to have the same name as the input file, you have to choose a different output folder.

## Automation

### Can LosslessCut be automated using a CLI or API, or do external post-processing?

While it was never designed for advanced batching/automation, it does have a [basic CLI](cli.md) and an [HTTP API](api.md). More info: [#980](https://github.com/mifi/lossless-cut/issues/980) [#868](https://github.com/mifi/lossless-cut/issues/868).

### Why doesn't `--keyboard-action createNumSegments` (or another action that opens a dialog) work from a script?

Actions that open a dialog cannot be scripted. See [Actions that open a dialog cannot be scripted](cli.md#actions-that-open-a-dialog-cannot-be-scripted).

### Can LosslessCut do the same batch conversion operation on multiple files?

Probably not, but [you can probably do it yourself!](batch.md)

## Commonly requested features

### Can LosslessCut crop, resize, add effects, re-encode or mix audio?

LosslessCut can't **crop, resize, stretch, mirror/flip, reverse, overlay text/images, watermark, blur, redact, reduce quality/re-encode, create GIF, slideshow, burn subtitles, color grading, fade/transition between video clips, fade/combine/mix/merge audio tracks, mute audio channels or change audio volume**. These are all lossy operations (meaning you *have* to re-encode the file), but in the future I may start to implement such features. [See #372](https://github.com/mifi/lossless-cut/issues/372). Related: [#643](https://github.com/mifi/lossless-cut/issues/643).

### When will you implement feature X?

I have limited time and I have a lot of projects to work on, so I cannot promise any timeline. I will usually prioritize the issues with the most likes, [see here for a list of the most popular issues](https://github.com/mifi/lossless-cut/issues/691).

### Can you publish through winget, Flatpak, Docker or other package managers?

In general I don't want to maintain more build systems, but I could be open to linking to externally maintained build systems. See [winget](https://github.com/mifi/lossless-cut/issues/1279), [Flatpak](https://github.com/mifi/lossless-cut/pull/1813) and [Docker](https://github.com/mifi/lossless-cut/issues/1086).
