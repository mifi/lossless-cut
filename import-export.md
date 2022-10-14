# Import / export

LosslessCut allows importing/exporting your project (segments) in a variety of file formats.

## CSV

- The CSV export/import function takes CSV files with one cut segment on each line. Each line contains three columns: `segment start`, `segment end`, `label`.
- `segment start` and `segment end` are expressed in seconds or left empty. Empty `segment end` means segment ends at the duration of the video.
- Use comma `,` to separate the fields (**not** semicolon `;`)

### example.csv
```csv
,56.9568,First segment starting at 0
70,842.33,"Another quoted label"
1234,,Last segment
```

## More formats?

See https://github.com/mifi/lossless-cut/issues/1340
