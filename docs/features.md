# Features ✨

LosslessCut cuts, merges and edits video and audio files without re-encoding them, so it's fast and keeps the original quality.

Here's everything it can do, and what people use it for. Which functions are available depends on the file and its format and codecs. See also the [Recipe cookbook](recipes.md) for step-by-step instructions.

## Cutting

- Lossless cutting of most video and audio formats
- Cut away parts of a file (for example commercials), or keep only the parts you want
- Export each segment as its own file, merge them into one file, or both
- Rearrange the order of the segments
- Type in cut point times
- Timeline with zoom and frame/keyframe jumping, for cutting around keyframes
- Video thumbnails and audio waveform on the timeline
- Play or loop the current segment, or all selected segments in order
- [Smart cut](https://github.com/mifi/lossless-cut/issues/126) (experimental), to allow cutting between keyframes. It doesn't work for all files.
- Choose between keyframe cut and normal cut, and fine-tune other export options
- Optional **Full re-encode (H.264/AAC MP4)** in Export options for frame-accurate cuts without keyframe restrictions. Re-encodes each complete segment using CRF 18, the fast preset, and AAC 192 kbit/s; slower, with some quality loss. Remembers the selection, sets MP4 automatically, and bypasses Smart cut. Includes selected video and audio tracks from the main file at normal output speed.
- Extremely fast removal of all non-keyframes, "Decimate video" (for example for a timelapse)
- Speed up or slow down a video or audio file ([by changing the FPS](https://github.com/mifi/lossless-cut/issues/1712)). Do this as a separate step, not while cutting.
- Lossless crop and aspect ratio change of H.264/H.265 video (not all players respect it)

Lossless cuts can only start at a keyframe, so a cut starts at the keyframe before your cut point, a fraction of a second up to several seconds earlier depending on the encoding. See [Troubleshooting](troubleshooting.md) for more.

## Segments

- Segments, and markers (segments without an end)
- Divide the timeline into segments of a length, a file size (X MB) or a number of segments, or randomized segments
- Detect black scenes, silent audio and scene changes, and create segments from them
- Create segments from keyframes, and from the file's chapters
- Invert, split, duplicate, shift, shuffle and combine segments, fill the gaps between them, and align them to keyframes
- Give segments labels and tags
- Select and change segments with a JavaScript-based [expression language](expressions.md)
- [Import](index.md#importexport-projects) segments from MP4/MKV chapters, CSV, EDL (MPlayer, CMX 3600), YouTube chapters, Cutlist, CUE, DaVinci Resolve/Final Cut Pro XML, FCPXML, PotPlayer bookmarks, SRT subtitles, OpenTimelineIO and DV Analyzer
- Export segments as CSV, TSV/TXT, SRT subtitles or YouTube chapter timestamps
- Turn segments into chapters in an otherwise unmodified file ("Segments to chapters" export mode)
- Segments are saved per file in a project file (`.llc`)
- Undo/redo of segment changes

## Merging

- Lossless merge/concatenation of files with identical codec parameters (for example from the same camera)
- Checks that the files are compatible before merging
- Optionally create chapters from the merged files

## Tracks

- Combine tracks from multiple files (for example add a music or subtitle track to a video)
- Remove tracks you don't need
- Shift the tracks of an added file in time, for example to sync audio from another recording
- Extract all tracks from a file into separate files: video, audio, subtitles, attachments and others
- Keep data tracks, like GoPro telemetry (GPMF)
- Choose the video and audio tracks for playback, and play several audio tracks at once
- View subtitles

## Metadata

- View technical data about all tracks
- Edit the file's metadata, and each track's metadata and disposition
  - Suggestions for common metadata keys and languages
  - Copy metadata from another track or file, or apply a value to all tracks of the same type
  - See which tracks have changed, and reset the changes
- Change the rotation/orientation metadata of videos
- Set the codec tag, for example `hvc1` so H.265 plays on Apple devices, and apply bitstream filters
- Set the cover art from a frame on the timeline
- Apply a per-file timecode offset (and load the timecode from the file)
- Set the output files' modification date, for example to the original's
- Show the embedded GPS track (for example from DJI drones) on a map

## Formats and export

- Opens almost any format FFmpeg can read. Files that the built-in player can't play are played through FFmpeg automatically, while the export is still lossless from the original file.
- Losslessly remux video/audio into a different container (file) format
- Fix an incorrect file duration
- Output file names from a customizable template
- Take full-resolution snapshots from videos as JPEG/PNG (low or high quality), or copy them to the clipboard
- Export ranges of video frames to images: every frame, every nth frame or second, at scene changes, or the best image every nth second
  - Only from a selected time range (segment)
  - Optionally with the original timestamps in the image file names
- Losslessly download videos over HTTP (for example HLS `.m3u8`), saved as MKV

## Workflow

- Open many files as a batch list, and go through them one at a time (there's no batch export, but see [Batch processing](batch.md))
- Convert a whole batch of files to a supported format
- Keyboard shortcut workflow, with customizable shortcuts
- See the FFmpeg commands that were run, so you can change and re-run them on the command line
- Basic [CLI](cli.md) and [HTTP API](api.md)
- Simple and advanced mode, dark and light themes, and 26 languages

## Example use cases

Everything here is lossless unless noted.

- Cut out commercials from a recorded TV show (and change it from TS to MP4)
- Join clips from the same camera or phone into one file
- Rough-cut long recordings, keeping only the good parts, to save disk space
- Remove an audio track from a file
- Extract the music track from a video and cut it to your needs
- Add music to a video, or replace its audio track
- Combine audio and video tracks from separate recordings, and shift the audio to sync it
- Add an external subtitle file to a video
- Copy track titles and languages from one file to another when combining tracks
- Change the language of a file's audio or subtitle tracks
- Change an H264/H265 MKV video to MOV or MP4, for example for playback on an iPhone (set the `hvc1` codec tag for H.265)
- Cut a file by its MP4/MKV chapters
- Add chapters to a video, or remove them
- Make chapter timestamps for a YouTube video description
- Cut a YouTube video (downloaded with [yt-dlp](https://github.com/yt-dlp/yt-dlp)) by its chapters, or by a list of times from a comment
- Import a list of cut times from another tool as an EDL (edit decision list, CSV) and make those cuts, or export your cut times as a CSV EDL for another tool
- Save an HLS (`.m3u8`) live stream or video to a file
- Attach cover art or a thumbnail to a video or audio file, from a JPEG file or a frame on the timeline
- Change the author, title, GPS position or recording time of a video
- Fix the rotation of a video that has the wrong orientation flag
- Crop away black bars (H.264/H.265)
- Make a timelapse by keeping only the keyframes
- Fix a file that shows the wrong duration
- Loop a video or audio clip X times without re-encoding (see [#284](https://github.com/mifi/lossless-cut/issues/284))
- Split a video into one file per scene (you'll probably have to shift the segments, see [#330](https://github.com/mifi/lossless-cut/issues/330))
- Cut away the silent parts of an audio or video file
- Split a video into parts of a maximum length, for example for a social media platform's limit
- Tag segments, then use the tags to organize them, or to create an output folder structure for them
- Mark moments with markers and take a screenshot of each (not lossless)
- Convert a video, or parts of it, into image files (not lossless)
