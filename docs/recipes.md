# Recipe cookbook 📝

Here you can find many common use cases that can help you effectivize your workflow. 🏎️

## Export cut times as YouTube Chapters ▶️

1. Export with Merge and "Create chapters from merged segments" enabled.
2. Open the exported file and select "Import chapters" in the dialog.
3. File -> Export project -> YouTube Chapters.

## Re-encode only the audio track, keeping the lossless video track 🔊

1. Export each video/audio track to individual files.
2. Use Handbrake or similar to re-encode the audio file (if MP4/MOV file, encode it as AAC.)
3. Open the extracted video stream in LosslessCut. The open your encoded audio file and select "Include all tracks from the new file".
4. Export.

## Advanced multi-step workflows 🔢

Use LosslessCut in multiple passes in order to achieve separate trimming of individual tracks:
1. Open a file an export all tracks as individual files.
2. Open the exported track files independently and cut them as desired.
3. Add the track back to the video and combine them to one output video.

## Cut multiple files and merge them all

See also [#2631](https://github.com/mifi/lossless-cut/issues/2631).

1. Drag-drop source files (from the same camera/source) into losslesscut to open them in the batch list.
2. Sort them as needed.
3. Open the first file and edit it as needed.
4. Open the export options dialog.
5. Open "Output file names", edit the template and set it to e.g.:
  - `my-movie-all-segments-${String(EXPORT_COUNT).padStart(3, '0')}-${String(SEG_NUM_INT).padStart(3, '0')}${EXT}`
  - This will make sure that output file names will be created in the order of export and order of segment, e.g.: `my-movie-all-segments-001-001.mp4`
6. Export.
7. Now open each of the rest of the files in the batch list in the order that you want them, edit and export.
8. Once done exporting all, close the batch list.
9. You will have a folder with all the ordered segments, now drag drop them into LosslessCut and sort by name in the batch list.
10. Merge
