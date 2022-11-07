# Import / Export


## Exporting multiple files

When exporting multiple segments as separate files, LosslessCut offers you the ability to specify how the output files will be named in sequence. The following (variables) are available to customize the filenames: 

| Variable           | Output |          
| ------------- |--------|
| ${FILENAME}   | The original filename without the extension (eg **Beach Trip** for a file named "Beach Trip.mp4")
| ${EXT}        | The extension of the file (eg: **.mp4**, **.mkv**)
| ${SEG\_NUM}    | Number of the segment (eg **1**, **2**, **3**)
| ${SEG\_LABEL}  | The given label of the file (eg **Getting\_Lunch**)
| ${SEG\_SUFFIX} | If a label exists for this segment, the label will be used. Otherwise, the segment number will be used (eg **Getting\_Lunch**, **1**)
| ${CUT\_FROM}   | cutFrom - The timestamp for the beginning of the segment in hh.mm.ss.sss format (eg **00.00.27.184**)
| ${CUT\_TO}     | cutTo - The timestamp for the ending of the segment in hh.mm.ss.sss format (eg **00.00.27.184**)
| ${SEG\_TAGS.**XX**}   | Allows you to retrieve the json tags for a given segment by name. If a tag is called foo, it can be accessed with $**{SEG\_TAGS.foo}**

Typically, your files should always have a unique identifer (such as SET\_NUM or CUT\_FROM), and they must always end in ${EXT}. For instance, to achieve a filename sequence of **Beach Trip - 1.mp4, Beach Trip - 2.mp4, Beach Trip - 3.mp4**, etc, your format should read: 

```
${FILENAME} - ${SEG_NUM}${EXT}
```



##  Export formats

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

### More formats?

See https://github.com/mifi/lossless-cut/issues/1340
