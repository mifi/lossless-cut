# Import / Export

## Customising exported file names

When exporting multiple segments as separate files, LosslessCut offers you the ability to specify how the output files will be named in sequence using a *template string*. The template string is evaluated as a [JavaScript template string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals), so you can use JavaScript syntax inside of it.

The following variables are available in the template to customize the filenames:

| Avail when merging? | Variable | Type | Output |
| - | - | - | - |
| ✅ | `${FILENAME}` | `string` | The original filename *without the extension* (e.g. `Beach Trip` for a file named `Beach Trip.mp4`).
| ✅ | `${EXT}` | `string` | The extension of the file (e.g.: `.mp4`, `.mkv`).
| ✅ | `${EPOCH_MS}` | `number` | Number of milliseconds since epoch (e.g. `1680852771465`). Useful to generate a unique file name on every export to prevent accidental overwrite.
| ✅ | `${EXPORT_COUNT}` | `number` | Number of exports done since last LosslessCut launch (starts at 0).
| | `${FILE_EXPORT_COUNT}` | `number` | Number of exports done since last file was opened (starts at 0).
| | `${SEG_NUM}` | `string` | Segment index, padded string (e.g. `01`, `02` or `42`).
| | `${SEG_NUM_INT}` | `number` | Segment index, as an integer (e.g. `1`, `2` or `42`). Can be used with numeric arithmetics, e.g. `${SEG_NUM_INT+100}`.
| | `${SEG_LABEL}` | `string` | The label of the segment (e.g. `Getting Lunch`).
| | `${SEG_SUFFIX}` | `string` | If a label exists for this segment, the label will be used, prepended by `-`. Otherwise, the segment index prepended by `-seg` will be used (e.g. `-Getting_Lunch`, `-seg1`).
| | `${CUT_FROM}` | `string` | The timestamp for the beginning of the segment in `hh.mm.ss.sss` format (e.g. `00.00.27.184`).
| | `${CUT_TO}` | `string` | The timestamp for the ending of the segment in `hh.mm.ss.sss` format (e.g. `00.00.28.000`).
| | `${SEG_TAGS.XX}` | `object` | Allows you to retrieve the tags for a given segment by name. If a tag is called foo, it can be accessed with `${SEG_TAGS.foo}`. Note that if the tag does not exist, it will yield the text `undefined`. You can work around this as follows: `${SEG_TAGS.foo ?? ''}`

Your files must always include at least one unique identifer (such as `${SEG_NUM}` or `${CUT_FROM}`), and it should end in `${EXT}` (or else players might not recognise the files). For instance, to achieve a filename sequence of `Beach Trip - 1.mp4`, `Beach Trip - 2.mp4`, `Beach Trip - 3.mp4`, your format should read `${FILENAME} - ${SEG_NUM}${EXT}`. If your template gives at least two duplicate output file names, LosslessCut will revert to using the default template instead.

### JavaScript tips

#### Padding numbers

If you need to pad a number, you can use this JavaScript code around the variable. For example to pad the `FILE_EXPORT_COUNT` variable to 2 digits with leading zeros: `${String(FILE_EXPORT_COUNT).padStart(2, '0')}`

If you need more help, you can ask an AI to help you with this, e.g. "How to pad a number with JavaScript?"

## Import/export projects

LosslessCut also allows importing/exporting your project (segments) in a variety of file formats. See [list of supported formats](https://github.com/mifi/lossless-cut/issues/1340).

### CSV

- The CSV export/import function takes CSV files with one cut segment on each line. Each line contains three columns: `segment start`, `segment end`, `label`.
- `segment start` and `segment end` are expressed in seconds or left empty. Empty `segment end` means segment ends at the duration of the video.
- Use comma `,` to separate the fields (**not** semicolon `;`)

#### example.csv

```csv
,56.9568,First segment starting at 0
70,842.33,"Another quoted label"
1234,,Last segment
```

### TSV

Same as CSV but `<tab>` instead.
