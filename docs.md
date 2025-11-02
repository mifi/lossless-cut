# Documentation

## Typical workflow

- **Drag and drop** a video file into player or use <kbd>⌘</kbd>/<kbd>CTRL</kbd> + <kbd>O</kbd>.
- <kbd>SPACE</kbd> to play/pause or <kbd>←</kbd> <kbd>→</kbd> <kbd>,</kbd> <kbd>.</kbd> or mouse/trackpad wheel to seek back/forth.
- Set the start/end times of the current segment by first moving the timeline cursor and then pressing <kbd>I</kbd> to set start time and <kbd>O</kbd> to set end time.
- <kbd>+</kbd> to create a new segment.
- <kbd>B</kbd> to split the segment at the timeline cursor.
- <kbd>BACKSPACE</kbd> to remove cutpoint/segment.
- If you create segments without an end time, it is a [marker](#markers) instead of a segment.
  - Note that when exporting, all segments you create will be **preserved** and exported as new files. You can change this behavior with the **Yin Yang** symbol ☯️, in which case the behaviour is inverted and LosslessCut will instead **skip** all selected segments and export the parts **between** segments as files.
  - Also note that start times will not be accurate, see [Known issues](issues.md).
- *(optional)* <kbd>+</kbd> to add another segment at the current cursor time. Then select the segment end time with <kbd>O</kbd>.
- *(optional)* If you want to merge all the selected segments into one file after cutting, change the `Export mode` from `Separate files` to `Merge cuts`.
- *(optional)* If you want to export to a certain output folder, press the `Working dir unset` button (defaults to same folder as source file).
- *(optional)* If you want to change orientation, press the **rotation** button.
- *(optional)* By default, most audio, video and subtitle tracks from the input file will be cut and exported. Press the `Tracks` button to customise and/or add new tracks from other files.
- *(optional)* Select a new output format (remux).
- *(optional)* In the right-hand segments panel, right click a segment for options, or drag-drop to reorder. Segments will appear in this order in the merged output.
- **When done, press the `Export` button (or <kbd>E</kbd>) to show an overview with export options.**
- *(optional)* Adjust any export options.
- **Then press `Export` again to confirm the export**
- Press the **Camera** button (or <kbd>C</kbd>) if you want to take a JPEG/PNG snapshot from the current time.
- If you want to move the original file to trash, press the **trash** button.
- For best results you may need to trial and error with another output format (Matroska can hold nearly everything), change keyframe cut mode or disable some tracks (see [known issues](issues.md)).
- Press <kbd>SHIFT</kbd> + <kbd>/</kbd> to view and edit all keyboard & mouse shortcuts.
- **Note:** The original video file will not be modified. Instead, a file is created file in the same directory as the original file with from/to timestamps in the file name.
- See Keyboard shortcuts dialog for more custom actions. (<kbd>SHIFT</kbd> + <kbd>/</kbd>)

## Primer: Video & audio formats vs. codecs

Here's a little primer about video and audio formats for those not familiar. A common mistake when dealing with audio and video files, is to confuse *formats*, *codecs*, and *file names*. In short: A file's media format is a *container* that holds one or more *codecs* (audio/video/subtitle) inside of it. For example `.mov` is a *container format*, and `H265`/`HEVC` is a *codec*. Some formats support only a few codecs inside of them, while others support more codecs. The most common formats are MP4/MOV (often `.mp4`,`.mov`,`.m4a`) and Matroska (often `.mkv`,`.mka`). Example: If you have a file named `My video.mp4`, this file most likely (but not necessarily) has the *format* `MP4`. Note that the extension of a file (in this case `.mp4`) doesn't really mean anything, and the file could in reality for example have the `MOV` format, or the extension could be `.txt`. Inside `My video.mp4` there are multiple tracks/streams, each with their own *codec*. In this example, let's say that it contains one `H264` track and one `AAC` track. In LosslessCut you can view and add/delete/modify these tracks.

**Remuxing**: If you change the output format in LosslessCut and export a file, you are *remuxing* the tracks/codecs into a different container format. When you do this, the operation is in theory lossless, meaning you will not lose any codec data and the different tracks will remain exactly the same, even though the format is now different (but some format metadata might get lost due to incompatibilities between container formats). There are limitations: Some popular codecs like VP8 or VP9 are not supported in popular formats like MP4, and some popular formats like Matroska (`.mkv`) are not natively supported in popular video players like iPhone or QuickTime.

If you want to reduce the size of a file using LosslessCut you have to "get rid of" something, either:
- Reduce the duration of the file (cut off start/end)
- Remove one or more tracks/streams (e.g. remove an audio track that you don't need)
Other than that you it's not possible convert a file losslessly to reduce its size, unless you re-encode and lose quality. For that, I recommend using a different tool like e.g. [HandBrake](https://handbrake.fr/).

Here is a great introduction to audio/video: [howvideo.works](https://howvideo.works/).

## Segments

Segments are the first class citizens of LosslessCut. A segment is a time-slice of your media file, defined by a *start time* and an *end time*. When a segment has no *end time*, it's called a [marker](#markers).
Segments have a segment number (their export order), and can optionally have a label and tags. Segments are be the basis of what gets exported.

### Markers

A segment that has no *end time* is called a *marker*. It has no length and will be excluded from exports, but behaves similar to segments. Markers are distinctively visualized on the timeline with a vertical line and a number on top. You can convert markers to segments by setting their out-point (<kbd>O</kbd>). This can be done manually or by one of the many tools in LosslessCut. For example you can invert all segments on the timeline to convert all markers into segments.

## Tracks

The LosslessCut tracks panel is used to selectively enable/disable individual tracks for export and edit track or file metadata. It can also be used to change [content disposition.](https://github.com/mifi/lossless-cut/discussions/2291)

## Custom exported file names

When exporting segments as files, LosslessCut offers you the ability to specify how the output files will be named in sequence using a *template string*. The template string is evaluated as a [JavaScript template string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals), so you can use JavaScript syntax inside of it.

The following variables are available in the template to customize the filenames:

| Avail. for merge files? | Avail. for cut+merge? | Variable | Type | Output |
| - | - | - | - | - |
| ✅ | ✅ | `${FILENAME}` | `string` | The original filename *without the extension* (e.g. `Beach Trip` for a file named `Beach Trip.mp4`). When merging files it's the *first* original file name.
| ✅ | ✅ | `${EXT}` | `string` | The extension of the file (e.g.: `.mp4`, `.mkv`).
| ✅ | ✅ | `${EPOCH_MS}` | `number` | Number of milliseconds since epoch (e.g. `1680852771465`). Useful to generate a unique file name on every export to prevent accidental overwrite.
| ✅ | ✅ | `${EXPORT_COUNT}` | `number` | Number of exports done since last LosslessCut launch (starts at 1).
| | ✅ | `${FILE_EXPORT_COUNT}` | `number` | Number of exports done since last file was opened (starts at 1).
| ✅ | ✅ | `${SEG_LABEL}` | `string` / `string[]` | The label of the segment (e.g. `Getting Lunch`). In cut+merge mode, this will be an `Array`, and you can use e.g. this code to combine all labels with a comma between: `${SEG_LABEL.filter(label => label).join(',')}`. When merging files it's each original merged file's name.
| | | `${SEG_NUM}` | `string` | Segment index, padded string (e.g. `01`, `02` or `42`).
| | | `${SEG_NUM_INT}` | `number` | Segment index, as an integer (e.g. `1`, `2` or `42`). Can be used with numeric arithmetics, e.g. `${SEG_NUM_INT+100}`.
| | | `${SELECTED_SEG_NUM}` | `string` | Same as `SEG_NUM`, but it counts only selected segments.
| | | `${SELECTED_SEG_NUM_INT}` | `number` | Same as `SEG_NUM_INT`, but it counts only selected segments.
| | | `${SEG_SUFFIX}` | `string` | If a label exists for this segment, the label will be used, prepended by `-`. Otherwise, the segment index prepended by `-seg` will be used (e.g. `-Getting_Lunch`, `-seg1`).
| | | `${CUT_FROM}` | `string` | The timestamp for the beginning of the segment in `hh.mm.ss.sss` format (e.g. `00.00.27.184`).
| | | `${CUT_FROM_NUM}` | `number` | Same as `${CUT_FROM}`, but numeric, meaning it can be used with arithmetics.
| | | `${CUT_TO}` | `string` | The timestamp for the ending of the segment in `hh.mm.ss.sss` format (e.g. `00.00.28.000`).
| | | `${CUT_TO_NUM}` | `number` | See `${CUT_FROM_NUM}`.
| | | `${CUT_DURATION}` | `string` | The duration of the segment (`CUT_TO-CUT_FROM`) in `hh.mm.ss.sss` format (e.g. `00.00.28.000`).
| | | `${SEG_TAGS.XX}` | `object` | Allows you to retrieve the tags for a given segment by name. If a tag is called foo, it can be accessed with `${SEG_TAGS.foo}`. Note that if the tag does not exist, it will yield the text `undefined`. You can work around this as follows: `${SEG_TAGS.foo ?? ''}`

Your files must always include at least one unique identifer (such as `${SEG_NUM}` or `${CUT_FROM}`), and it should end in `${EXT}` (or else players might not recognise the files). For instance, to achieve a filename sequence of `Beach Trip - 1.mp4`, `Beach Trip - 2.mp4`, `Beach Trip - 3.mp4`, your format should read `${FILENAME} - ${SEG_NUM}${EXT}`. If your template gives at least two duplicate output file names, LosslessCut will revert to using the default template instead.

### JavaScript expression tips

#### Padding numbers

If you need to pad a number, you can use this JavaScript code around the variable. For example to pad the `FILE_EXPORT_COUNT` variable to 2 digits with leading zeros: `${String(FILE_EXPORT_COUNT).padStart(2, '0')}`

If you need more help, you can ask an AI to help you with this, e.g. "How to pad a number with JavaScript?"

## Import / export projects

LosslessCut also allows importing/exporting your project (segments) in a variety of file formats. See [list of supported formats](https://github.com/mifi/lossless-cut/issues/1340).

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

- [FAQ, known issues, limitations and troubleshooting](issues.md)
- [Command line interface (CLI)](cli.md)
- [HTTP API](api.md)
