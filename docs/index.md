# Documentation

Please read the documentation before creating an issue. Thank you 🙏

## FAQ

- **Q:** Is there a keyboard shortcut to do X?
  - **A:** First check the Keyboard shortcuts dialog. If you cannot find your shortcut there, [see this issue.](https://github.com/mifi/lossless-cut/issues/254)
- **Q:** Can LosslessCut be automated using a CLI or API or do external post-processing?
  - **A:** While it was never designed for advanced batching/automation, it does have a [basic CLI and a HTTP API](cli.md). More info: [#980](https://github.com/mifi/lossless-cut/issues/980) [#868](https://github.com/mifi/lossless-cut/issues/868).
- **Q:** How to *cut away* a middle part of a video?
  - **A:** Enable "advanced view" and then click the Yin Yang symbol. It will invert the segments.
- **Q** What's the difference between the app in the Apple/Microsoft App Store vs. GitHub releases?
  - **A** LosslessCut version in the App Stores is often a few versions behind the latest GitHub version, because I want to be sure that the new versions work perfectly before releasing in the App Stores. The GitHub version will contain new, untested features and may contain some bugs (even in existing functionality). I consider the newest GitHub versions to be a public "beta" test. Then, once I'm sure that the new version works well, I will release it in the App Stores as well to give a frictionless as possible experience for customers. They have exactly the same in-app features, except for a few platform limitations: Apple doesn't allow opening VOB files with App Store apps. Apple App Store apps run in a sandbox, and therefore need to prompt for output directory before allowing writing files.

## Commonly requested features

- **Q:** Can LosslessCut **crop, resize, stretch, mirror/flip, overlay text/images, watermark, blur, redact, reduce quality/re-encode, create GIF, slideshow, burn subtitles, color grading, fade/transition between video clips, fade/combine/mix/merge audio tracks, mute audio channels or change audio volume**?
  - **A:** No, these are all lossy operations (meaning you *have* to re-encode the file), but in the future I may start to implement such features. [See #372](https://github.com/mifi/lossless-cut/issues/372). Related: [#643](https://github.com/mifi/lossless-cut/issues/643).
- **Q:** When will you implement feature X?
  - **A:** I have limited time and I have a lot of projects to work on, so I cannot promise any timeline. I will usually prioritize the issues with the most likes, [see here for a list of the most popular issues](https://github.com/mifi/lossless-cut/issues/691).
- **Q:** Can LosslessCut do the same batch conversion operation on multiple files?
  - **A:** Probably not, but [you can probably do it yourself!](batch.md)
- **Q:** Is LosslessCut a portable app? Where is application data, settings and temp files stored?
  - **A:** See LosslessCut is *not* a [portable app](https://github.com/mifi/lossless-cut/issues/645). See [Installation and files](installation.md).
- **Q:** Can I export and replace the input file in-place?
  - **A:** No, but you can export and automatically delete the input file.
- **Q:** Can you publish through [winget](https://github.com/mifi/lossless-cut/issues/1279), [Flatpak](https://github.com/mifi/lossless-cut/pull/1813), [Docker](https://github.com/mifi/lossless-cut/issues/1086) or other software mangers?
  - **A:** In general I don't want to maintain more build systems, but I could be open to linking to externally maintained build systems.
- **Q:** How to sync/shift audio/video tracks?
  - **A:** This is not natively supported but it can be done with a workaround, see [#216](https://github.com/mifi/lossless-cut/issues/216).

## Troubleshooting

If you have a problem with the app or with a file, please see the [troubleshooting guide](troubleshooting.md).

## Usage: Typical workflow

- **Drag and drop** a video file into player or use <kbd>⌘</kbd>/<kbd>CTRL</kbd> + <kbd>O</kbd>.
- <kbd>SPACE</kbd> to play/pause or <kbd>←</kbd> <kbd>→</kbd> <kbd>,</kbd> <kbd>.</kbd> or mouse/trackpad wheel to seek back/forth.
- Set the start/end times of the current segment by first moving the timeline cursor and then pressing <kbd>I</kbd> to set start time and <kbd>O</kbd> to set end time.
- <kbd>+</kbd> to create a new segment.
- <kbd>B</kbd> to split the segment at the timeline cursor.
- <kbd>BACKSPACE</kbd> to remove cutpoint/segment.
- If you create segments without an end time, it is a [marker](#markers) instead of a segment.
  - Note that when exporting, all segments you create will be **preserved** and exported as new files. You can change this behavior with the **Yin Yang** symbol ☯️, in which case the behaviour is inverted and LosslessCut will instead **skip** all selected segments and export the parts **between** segments as files.
  - Also note that start times will not be accurate, see [Known issues](troubleshooting.md).
- *(optional)* <kbd>+</kbd> to add another segment at the current cursor time. Then select the segment end time with <kbd>O</kbd>.
- *(optional)* If you want to merge all the selected segments into one file after cutting, change the `Export mode` from `Separate files` to `Merge cuts`.
- *(optional)* If you want to export to a certain output folder, press the `Working dir unset` button (defaults to same folder as source file).
- *(optional)* If you want to change orientation, press the **rotation** button.
- *(optional)* By default, most audio, video and subtitle tracks from the input file will be cut and exported. Press the `Tracks` button to customise and/or add new tracks from other files.
- *(optional)* Select a new output format (remux).
- *(optional)* In the right-hand segments panel, right click a segment for options, or drag-drop to reorder. Segments will appear in this order in the merged output.
- **When done, press the `Export` button (or <kbd>E</kbd>) to show an overview with export options.**
- *(optional)* Adjust any export options.
- *(optional)* Change the [Output file name template](file-name-template.md).
- **Then press `Export` again to confirm the export**
- Press the **Camera** button (or <kbd>C</kbd>) if you want to take a JPEG/PNG snapshot from the current time.
- If you want to move the original file to trash, press the **trash** button.
- For best results you may need to trial and error with another output format (Matroska can hold nearly everything), change keyframe cut mode or disable some tracks (see [known issues](troubleshooting.md)).
- Press <kbd>SHIFT</kbd> + <kbd>/</kbd> to view and edit all keyboard & mouse shortcuts.
- **Note:** The original video file will not be modified. Instead, a file is created file in the same directory as the original file with from/to timestamps in the file name.
- See Keyboard shortcuts dialog for more custom actions. (<kbd>SHIFT</kbd> + <kbd>/</kbd>)

## Primer: Video/audio codecs vs. formats

Here's a little primer about video and audio formats for those not familiar. A common mistake when dealing with audio and video files, is to confuse *formats*, *codecs*, and *file names*. In short: A file's media format is a *container* that holds one or more *codecs* (audio/video/subtitle) inside of it. For example `.mov` is a *container format*, and `H265`/`HEVC` is a *codec*. Some formats support only a few kinds of codecs inside of them (e.g. `.wav`), while others support almost all codecs (e.g. Matroska). The most common formats are MP4/MOV (often `.mp4`,`.mov`,`.m4a`) and Matroska (often `.mkv`,`.mka`). Example: If you have a file named `My video.mp4`, this file most likely (but not necessarily) has the *format* `MP4`. Note that the extension of a file (in this case `.mp4`) doesn't really mean anything, and the file could in reality for example have the `MOV` format, or the extension could be `.txt`. Inside `My video.mp4` there are multiple tracks/streams, each with their own *codec*. In this example, let's say that it contains one `H264` track and one `AAC` track. In LosslessCut you can view and add/delete/modify these tracks.

**Remuxing**: If you change the output format in LosslessCut and export a file, you are *remuxing* the tracks/codecs into a different container format. When you do this, the operation is in theory lossless, meaning you will not lose any codec data and the different tracks will remain exactly the same, even though the format is now different (but some format metadata might get lost due to incompatibilities between container formats). There are limitations: Some popular codecs like VP8 or VP9 are not supported in popular formats like MP4, and some popular formats like Matroska (`.mkv`) are not natively supported in popular video players like iPhone or QuickTime.

If you want to reduce the size of a file using LosslessCut you have to "get rid of" something, either:
- Reduce the duration of the file (cut off start/end)
- Remove one or more tracks/streams (e.g. remove an audio track that you don't need)
Other than that you it's not possible convert a file losslessly to reduce its size, unless you re-encode and lose quality. For that, I recommend using a different tool like e.g. [HandBrake](https://handbrake.fr/).

Here is a great introduction to audio/video: [howvideo.works](https://howvideo.works/).

## Segments

Segments are the first class citizens of LosslessCut. A segment is a time-slice of your source media file, defined by a *start time* and an *end time*. When a segment has no *end time*, it's called a *[marker](#markers)*.
Segments have a segment number (their export order), and can optionally have a label and tags. Segments are be the basis of what gets exported.

### Markers

A segment that has no *end time* is called a *marker*. It has no length and will be excluded from exports, but behaves similar to segments. Markers are distinctively visualized on the timeline with a vertical line and a number on top. You can convert markers to segments by setting their out-point (<kbd>O</kbd>). This can be done manually or automated with one of the many tools in LosslessCut. For example you can invert all segments on the timeline to convert all markers into segments.

## Tracks

Tracks are different from segments, in that the tracks run in parallel. For example most videos have one video track and one audio track. When cutting, LosslessCut will cut all tracks equally, although there are some tracks that [cannot be cut](troubleshooting.md). The LosslessCut tracks panel is used to selectively enable/disable individual tracks for export and edit track or file metadata. It can also be used to change [content disposition.](https://github.com/mifi/lossless-cut/discussions/2291)

## Import/export projects

LosslessCut default project file `.llc` is in a JSON5 format. It contains information about the segments in your timeline. LosslessCut also allows importing/exporting your project (segments) in a variety of file formats. See [list of supported formats](https://github.com/mifi/lossless-cut/issues/1340).

### CSV files

- The CSV export/import function takes CSV files with one cut segment on each line. Each line contains three columns: `segment start`, `segment end`, `label`.
- `segment start` and `segment end` are expressed in seconds. `segment end` may be empty, in that case it's a marker.
- Use comma `,` to separate the fields (**not** semicolon `;`)

#### Example `.csv` file

```csv
,56.9568,First segment starting at 0
70,842.33,"Another quoted label"
1234,,Last marker starting at 1234 seconds
```

### TSV files

Same as CSV but `<tab>` instead.

## More

- [🤔 Troubleshooting, known issues and limitations](troubleshooting.md)
- [📝 Recipe cookbook](recipes.md)
- [📲 Installation](installation.md)
- [✅ Requirements](requirements.md)
- [👨‍💻 JavaScript expressions](expressions.md)
- [🦾 Batch processing](batch.md)
- [📄 Export file name template documentation](file-name-template.md).
- [💻 Command line interface (CLI)](cli.md)
- [🕸️ HTTP API](api.md)
