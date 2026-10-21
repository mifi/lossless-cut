# Features ✨

LosslessCut cuts, merges and edits video and audio files without re-encoding them, so it's fast and keeps the original quality.

Here's everything it can do, and what people use it for. Which functions are available depends on the file and its format and codecs. See also the [Recipe cookbook](recipes.md) for step-by-step instructions.

## Cutting

- Lossless cutting of most video and audio formats
- Cut away parts of a file (for example commercials), or keep only the parts you want
- Rearrange the order of the segments
- Type in cut point times
- Timeline with zoom and frame/keyframe jumping, for cutting around keyframes
- Video thumbnails and audio waveform on the timeline
- [Smart cut](https://github.com/mifi/lossless-cut/issues/126) (experimental), to allow cutting between keyframes. It doesn't work for all files.
- Extremely fast removal of all non-keyframes (for example for a timelapse)
- Speed up or slow down a video or audio file ([by changing the FPS](https://github.com/mifi/lossless-cut/issues/1712))
- Lossless crop and aspect ratio change

Lossless cuts can only start at a keyframe, so a cut starts at the keyframe before your cut point, a fraction of a second up to several seconds earlier depending on the encoding. See [Troubleshooting](troubleshooting.md) for more.

## Segments

- Divide the timeline into segments of a length, a file size (X MB) or a number of segments, or randomized segments
- Detect black scenes, silent audio and scene changes, and create segments from them
- Give segments labels and tags
- Select and change segments with a JavaScript-based [expression language](expressions.md)
- [Import and export](index.md#importexport-projects) segments: MP4/MKV chapter marks, text files, YouTube, CSV, CUE, XML (DaVinci Resolve, Final Cut Pro) and more
- Edit the embedded chapter marks of MKV/MP4 files
- Segments are saved per file in a project file
- Undo/redo

## Merging

- Lossless merge/concatenation of files with identical codec parameters (for example from the same camera)

## Tracks

- Combine tracks from multiple files (for example add a music or subtitle track to a video)
- Remove tracks you don't need
- Replace or re-encode only some of the tracks
- Extract all tracks from a file into separate files: video, audio, subtitles, attachments and others
- Choose the video and audio tracks for playback, and play several audio tracks at once
- View subtitles

## Metadata

- View technical data about all tracks
- Edit the file's metadata, and each track's metadata and disposition
  - Suggestions for common metadata keys and languages
  - Copy metadata from another track or file, or apply a value to all tracks of the same type
  - See which tracks have changed, and reset the changes
- Change the rotation/orientation metadata of videos
- Apply a per-file timecode offset (and load the timecode from the file)
- Show the embedded GPS track (for example from DJI drones) on a map

## Formats and export

- Losslessly remux video/audio into a different container (file) format
- Take full-resolution snapshots from videos as JPEG/PNG (low or high quality)
- Export ranges of video frames to images: every nth frame or second, at scene changes, or the best thumbnails
  - Only from a selected time range (segment)
  - Optionally with the original timestamps in the image file names
- Losslessly download videos over HTTP (for example HLS `.m3u8`)

## Workflow

- Fast workflow for many files, one at a time (there's no batch export, see [Batch processing](batch.md))
- Keyboard shortcut workflow, with customizable shortcuts
- See the FFmpeg commands that were run, so you can change and re-run them on the command line
- Basic [CLI](cli.md) and [HTTP API](api.md)

## Example use cases

Everything here is lossless unless noted.

- Cut out commercials from a recorded TV show (and change it from TS to MP4)
- Remove an audio track from a file
- Extract the music track from a video and cut it to your needs
- Add music to a video, or replace its audio track
- Combine audio and video tracks from separate recordings
- Add an external subtitle file to a video
- Copy track titles and languages from one file to another when combining tracks
- Change the language of a file's audio or subtitle tracks
- Change an H264/H265 MKV video to MOV or MP4, for example for playback on an iPhone
- Cut a file by its MP4/MKV chapters
- Cut a YouTube video (downloaded with [yt-dlp](https://github.com/yt-dlp/yt-dlp)) by its chapters, or by a list of times from a comment
- Import a list of cut times from another tool as an EDL (edit decision list, CSV) and make those cuts, or export your cut times as a CSV EDL for another tool
- Attach cover art or a thumbnail to a video or audio file, from a JPEG file or a frame on the timeline
- Change the author, title, GPS position or recording time of a video
- Fix the rotation of a video that has the wrong orientation flag
- Loop a video or audio clip X times without re-encoding (see [#284](https://github.com/mifi/lossless-cut/issues/284))
- Split a video into one file per scene (you'll probably have to shift the segments, see [#330](https://github.com/mifi/lossless-cut/issues/330))
- Cut away the silent parts of an audio or video file
- Split a video into parts of a maximum length, for example for a social media platform's limit
- Tag segments, then use the tags to organize them, or to create an output folder structure for them
- Convert a video, or parts of it, into image files (not lossless)
