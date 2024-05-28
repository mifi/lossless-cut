# Import / Export

## Customising exported file names

When exporting multiple segments as separate files, LosslessCut offers you the ability to specify how the output files will be named in sequence using a *template string*. The template string is evaluated as a [JavaScript template string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals), so you can use JavaScript syntax inside of it. The following variables are available in the template to customize the filenames:

| Variable | Output |
| -------------- | - |
| `${FILENAME}` | The original filename *without the extension* (e.g. `Beach Trip` for a file named `Beach Trip.mp4`).
| `${EXT}` | The extension of the file (e.g.: `.mp4`, `.mkv`).
| `${SEG_NUM}` | Number of the segment, padded string (e.g. `01`, `02` or `42`).
| `${SEG_NUM_INT}` | Number of the segment, as a raw integer (e.g. `1`, `2` or `42`). Can be used with numeric arithmetics, e.g. `${SEG_NUM_INT+100}`.
| `${EPOCH_MS}` | Number of milliseconds since epoch (e.g. `1680852771465`).
| `${SEG_LABEL}` | The label of the segment (e.g. `Getting_Lunch`).
| `${SEG_SUFFIX}` | If a label exists for this segment, the label will be used, prepended by `-`. Otherwise, the segment number prepended by `-seg` will be used (e.g. `-Getting_Lunch`, `-seg1`).
| `${CUT_FROM}` | The timestamp for the beginning of the segment in `hh.mm.ss.sss` format (e.g. `00.00.27.184`).
| `${CUT_TO}` | The timestamp for the ending of the segment in `hh.mm.ss.sss` format (e.g. `00.00.28.000`).
| `${SEG_TAGS.XX}` | Allows you to retrieve the tags for a given segment by name. If a tag is called foo, it can be accessed with `${SEG_TAGS.foo}`. Note that if the tag does not exist, it will return the text `undefined`. You can work around this as follows: `${SEG_TAGS.foo ?? ''}`

Your files must always include at least one unique identifer (such as `${SEG_NUM}` or `${CUT_FROM}`), and they should end in `${EXT}` (or else players might not recognise the files). For instance, to achieve a filename sequence of `Beach Trip - 1.mp4`, `Beach Trip - 2.mp4`, `Beach Trip - 3.mp4`, your format should read `${FILENAME} - ${SEG_NUM}${EXT}`

##  Export project formats

LosslessCut also allows importing/exporting your project (segments) in a variety of file formats.

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

### More formats?

See https://github.com/mifi/lossless-cut/issues/1340
