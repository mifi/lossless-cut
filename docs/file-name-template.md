# Export file name template

When exporting segments as files, LosslessCut offers you the ability to specify how the output files will be named in sequence using a *template*. The template is evaluated as a [JavaScript template string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals), so you can use JavaScript syntax inside of it. For a technical description of all variables, see [`FileNameTemplateContext`](generated/types.md#filenametemplatecontext).

The following variables are available in the template to customize the filenames:

| Avail. for merge files? | Avail. for cut+merge? | Variable | Type | Output |
| - | - | - | - | - |
| ✅ | ✅ | `${FILENAME}` | `string` | The original filename *without the extension* (e.g. `Beach Trip` for a file named `Beach Trip.mp4`). When merging files it's the *first* original file name. |
| ✅ | ✅ | `${FILES}` | `SourceFile[]` | 🤓🧪 The original file(s) with various properties. An array of [`SourceFile`](generated/types.md#sourcefile) objects that can be queried using a JavaScript expression. Example: `${new Date(FILES[0].ctime).toISOString().replaceAll(':', '.').replaceAll('T', ' ')}` |
| ✅ | ✅ | `${EXT}` | `string` | The extension of the file (e.g.: `.mp4`, `.mkv`). |
| ✅ | ✅ | `${EPOCH_MS}` | `number` | Number of milliseconds since epoch (e.g. `1680852771465`). Useful to generate a unique file name on every export to prevent accidental overwrite. |
| ✅ | ✅ | `${EXPORT_COUNT}` | `number` | Number of exports done since last LosslessCut launch (starts at 1). |
| | ✅ | `${FILE_EXPORT_COUNT}` | `number` | Number of exports done since last file was opened (starts at 1). |
| ✅ | ✅ | `${SEG_LABEL}` | `string` / `string[]` | The label of the segment (e.g. `Getting Lunch`). In cut+merge mode, this will be an `Array`, and you can use e.g. this code to combine all labels with a comma between: `${SEG_LABEL.filter(label => label).join(',')}`. When merging files it's each original merged file's name. |
| | | `${SEG_NUM}` | `string` | Segment index, padded string (e.g. `01`, `02` or `42`). |
| | | `${SEG_NUM_INT}` | `number` | 🤓 Segment index, as an integer (e.g. `1`, `2` or `42`). Can be used with numeric arithmetics JavaScript expressions, e.g. `${SEG_NUM_INT+100}`. |
| | | `${SELECTED_SEG_NUM}` | `string` | Same as `SEG_NUM`, but it counts only selected segments. |
| | | `${SELECTED_SEG_NUM_INT}` | `number` | 🤓 Same as `SEG_NUM_INT`, but it counts only selected segments. |
| | | `${SEG_SUFFIX}` | `string` | If a label exists for this segment, the label will be used, prepended by `-`. Otherwise, the segment index prepended by `-seg` will be used (e.g. `-Getting_Lunch`, `-seg1`). |
| | | `${CUT_FROM}` | `string` | The timestamp for the beginning of the segment in `hh.mm.ss.sss` format (e.g. `00.00.27.184`). |
| | | `${CUT_FROM_NUM}` | `number` | 🤓 Same as `${CUT_FROM}`, but numeric, meaning it can be used with arithmetics. |
| | | `${CUT_TO}` | `string` | The timestamp for the ending of the segment in `hh.mm.ss.sss` format (e.g. `00.00.28.000`). |
| | | `${CUT_TO_NUM}` | `number` | 🤓 See `${CUT_FROM_NUM}`. |
| | | `${CUT_DURATION}` | `string` | The duration of the segment (`CUT_TO-CUT_FROM`) in `hh.mm.ss.sss` format (e.g. `00.00.28.000`). |
| | | `${SEG_TAGS.XX}` | `object` | Allows you to retrieve the tags for a given segment by name. If a tag is called foo, it can be accessed with `${SEG_TAGS.foo}`. Note that if the tag does not exist, it will yield the text `undefined`. You can work around it with this JavaScript expression: `${SEG_TAGS.foo ?? ''}` |

- 🤓 =  Advanced variables (for nerds) involving JavaScript expressions.
- 🧪 = Experimental.

Your files must always include at least one unique identifer (such as `${SEG_NUM}` or `${CUT_FROM}`), and it should end in `${EXT}` (or else players might not recognise the files). For instance, to achieve a filename sequence of `Beach Trip - 1.mp4`, `Beach Trip - 2.mp4`, `Beach Trip - 3.mp4`, your format should read `${FILENAME} - ${SEG_NUM}${EXT}`. If your template gives at least two duplicate output file names, LosslessCut will revert to using the default template instead. You can ask AI to help you create a template string by referring it to this page.

## Padding numbers

If you need to pad a number, you can use this JavaScript code around the variable. For example to pad the `FILE_EXPORT_COUNT` variable to 2 digits with leading zeros, we convert it to a `String` and then call `padStart` on the string: `${String(FILE_EXPORT_COUNT).padStart(2, '0')}`

If you need more help, you can ask an AI to help you with this, e.g. "How to pad a number with JavaScript?"
