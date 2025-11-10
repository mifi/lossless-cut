// FFProbe response types. Copied from https://gist.github.com/termermc/2a62735201cede462763456542d8a266
// See also https://github.com/DefinitelyTyped/DefinitelyTyped/blob/a21bbc63c5a31afbad57c3830582c389d32a931b/types/ffprobe/index.d.ts#L4

// These definitions are my best attempt at documenting the output of FFprobe using the "-print_format json" option
// The descriptions come mostly out of experience, deduction, and the very sparse documentation of the outputs
// Not all fields will be present (it depends on the file), but fields that are definite are not marked as optional
// Sample probe:
// ffprobe -v quiet -print_format json -show_format -show_streams -show_chapters -show_error my_file.mp4

/**
 * @typedef FFprobeDisposition
 * @property {number} default 1 if the default track
 * @property {number} dub 1 if a dub track
 * @property {number} original 1 if the original track
 * @property {number} comment 1 if a comment track
 * @property {number} lyrics 1 if a lyrics track
 * @property {number} karaoke 1 if a karaoke track
 * @property {number} forced 1 if a forced track
 * @property {number} hearing_impaired 1 if a track for the hearing impaired
 * @property {number} visual_impaired 1 if a track for the visually impaired
 * @property {number} clean_effects 1 if a clean effects track (meaning not entirely understood)
 * @property {number} attached_pic 1 if an attached picture track
 * @property {number} timed_thumbnails 1 if a timed thumbnails track (perhaps like the preview thumbnails you get when scrolling over a YouTube video's seek bar)
 * @property {number} captions 1 if a captions track
 * @property {number} descriptions 1 if a descriptions track
 * @property {number} metadata 1 if a metadata track
 * @property {number} dependent 1 if a dependent track (unclear meaning)
 * @property {number} still_image 1 if a still image track
 */

/**
 * @typedef FFprobeStreamTags
 * @property {string} [language] The track's language code (usually represented using a 3 letter language code, e.g.: "eng")
 * @property {string} [handler_name] The name of the handler which produced the track
 * @property {string} [vendor_id] The ID of the vendor which produced the track
 * @property {string} [encoder] The name of the encoder responsible for creating the stream
 * @property {string} [creation_time] The date (often ISO-formatted, but it may use other formats) when the media was created
 * @property {string} [comment] The comment attached to the stream
 */

/**
 * @typedef FFprobeStream
 * @property {number} index The stream index
 * @property {string} codec_name The codec's name
 * @property {string} codec_long_name The codec's long (detailed) name
 * @property {string} profile The codec profile
 * @property {'video'|'audio'|'subtitle'} codec_type The type of codec (video, audio, subtitle, etc)
 * @property {string} codec_tag_string The codec tag (technical name)
 * @property {string} codec_tag The codec tag ID
 * @property {string} [sample_fmt] The audio sample format (not present if codec_type is not "audio")
 * @property {string} [sample_rate] A string representation of an integer showing the audio sample rate (not present if codec_type is not "audio")
 * @property {number} [channels] The audio track's channel count (not present if codec_type is not "audio")
 * @property {'stereo'|'mono'} [channel_layout] The audio track's channel layout (e.g. "stereo") (not present if codec_type is not "audio")
 * @property {number} [bits_per_sample] Bits per audio sample (might not be accurate, may just be 0) (not present if codec_type is not "audio")
 * @property {number} [width] The video stream width (also available for images) (not present if codec_type is not "video")
 * @property {number} [height] The stream height (also available for images) (not present if codec_type is not "video")
 * @property {number} [coded_width] The stream's coded width (shouldn't vary from "width") (not present if codec_type is not "video")
 * @property {number} [coded_height] The stream's coded height (shouldn't vary from "height") (not present if codec_type is not "video")
 * @property {number} [closed_captions] Set to 1 if closed captions are present in stream... I think (not present if codec_type is not "video")
 * @property {number} [has_b_frames] Set to 1 if the stream has b-frames... I think (not present if codec_type is not "video")
 * @property {string} [sample_aspect_ratio] The sample aspect ratio (you probably want "display_aspect_ratio") (not present if codec_type is not "video")
 * @property {string} [display_aspect_ratio] The display (real) aspect ratio (e.g. "16:9") (not present if codec_type is not "video")
 * @property {string} [pix_fmt] The pixel format used (not present if codec_type is not "video")
 * @property {number} [level] Unknown (not present if codec_type is not "video")
 * @property {string} [color_range] The color range used (e.g. "tv") (not present if codec_type is not "video")
 * @property {string} [color_space] The color space used (not present if codec_type is not "video")
 * @property {string} [color_transfer] The color transfer used (not present if codec_type is not "video")
 * @property {string} [color_primaries] The color primaries used (not present if codec_type is not "video")
 * @property {string} [chroma_location] The chroma location (not present if codec_type is not "video")
 * @property {number} [refs] Unknown (not present if codec_type is not "video")
 * @property {'true'|'false'} [is_avc] Whether the stream is AVC (not present if codec_type is not "video")
 * @property {string} [nal_length_size] Unknown string representing a number (not present if codec_type is not "video")
 * @property {string} r_frame_rate Odd formatting of the frame rate, possibly "real frame rate"? (e.g. "30/1")
 * @property {string} avg_frame_rate Odd formatting of the average frame rate (e.g. "30/1")
 * @property {string} time_base The division equation to use for converting integer representations of timestamps into seconds (e.g. "1/30000" turns 80632552 into 2687.751733 seconds)
 * @property {number} start_pts Unknown
 * @property {string} start_time A string representation of a floating point integer showing the start time in seconds
 * @property {number} duration_ts The stream's duration in integer timestamp format (defined by time_base)
 * @property {string} duration A string representation of a floating point integer showing the stream duration in seconds
 * @property {string} [bit_rate] The string representation of an integer showing the stream bit rate (not present on lossless formats such as FLAC)
 * @property {string} [bits_per_raw_sample] A string representation of an integer showing the bits per raw sample (not present if codec_type is not "video")
 * @property {string} nb_frames A string representation of an integer showing the total number of frames in the stream
 * @property {FFprobeDisposition} disposition The stream's disposition
 * @property {FFprobeStreamTags} [tags] The stream's tags
 */

/**
 * @typedef FFprobeChapterTags
 * @property {string} title The chapter title
 */

/**
 * @typedef FFprobeChapter
 * @property {number} id The chapter ID
 * @property {string} time_base The division equation to use for converting integer representations of timestamps into seconds (e.g. "1/30000" turns 80632552 into 2687.751733 seconds)
 * @property {number} start When the chapter starts in integer timestamp format (defined by time_base)
 * @property {string} start_time The string representation of a floating point integer showing when the chapter starts in seconds
 * @property {number} end When the chapter end in integer timestamp format (defined by time_base)
 * @property {string} end_time The string representation of a floating point integer showing when the chapter ends in seconds
 * @property {FFprobeChapterTags} tags The chapter's tags
 */

/**
 * @typedef FFprobeFormatTags
 * @property {string} major_brand Not clear, probably the media type brand, but not sure
 * @property {string} minor_version The brand version perhaps, but not sure
 * @property {string} compatible_brands The brands that are compatible with the referenced brands perhaps, but not sure
 * @property {string} [title] The media's title (song metadata uses an all uppercase version)
 * @property {string} [artist] The media artist (song metadata uses an all uppercase version)
 * @property {string} [date] The media's creation date, seems to be in YYYYMMDD format (song metadata uses an all uppercase version)
 * @property {string} [encoder] The name of the encoder responsible for encoding the media
 * @property {string} [comment] The comment attached to the file
 * @property {string} [description] The description attached to the file
 * @property {string} [creation_time] The ISO-formatted date (although it may use other formats) when the media was created
 * @property {string} [ALBUM] The album (only present in audio files)
 * @property {string} [album_artist] The album arist (only present in audio files)
 * @property {string} [ALBUMARTISTSORT] The album artist name used for sorting probably (only present in audio files)
 * @property {string} [ARTIST] The song artist (only present in audio files)
 * @property {string} [DATE] The date when the song was created (no particular format, often the year) (only present in audio files)
 * @property {string} [disc] The string representation of an integer showing the song's disc number (only present in audio files)
 * @property {string} [DISCTOTAL] The string representation of an integer showing the total number of discs comprising the album the song is in (only present in audio files)
 * @property {string} [ISRC] The song's International Standard Recording Code
 * @property {string} [GENRE] The song's genre (only present in audio files)
 * @property {string} [TITLE] The song's title (only present in audio files)
 * @property {string} [track] The string representation of an integer showing the song's track number (only present in audio files)
 * @property {string} [TRACKTOTAL] The string representation of an integer showing the total number of tracks in the album the song is in (only present in audio files)
 * @property {string} [YEAR] The string representation of an integer showing the year the song was created (only present in audio files)
 * @property {string} [BPM] The string representation of an integer showing the song's BPM (only present in audio files)
 * @property {string} [PUBLISHER] The song's publisher (only present in audio files)
 */

/**
 * @typedef FFprobeFormat
 * @property {string} filename The path of the probed file (as specified in the input file argument)
 * @property {number} nb_streams The total number of streams present
 * @property {number} nb_programs The total number of programs present
 * @property {string} format_name The name of the format (a comma separated list of applicable file extensions for the format)
 * @property {string} format_long_name The long (detailed) name of the format
 * @property {string} start_time The string representation of a floating point integer showing the file's starting time
 * @property {string} duration The string representation of a floating point integer showing the file's duration in seconds (seems to be a non-accurate, rounded version of the real duration)
 * @property {string} size The string representation of a long integer showing the file's size in bytes
 * @property {string} bit_rate The string representation of a long integer showing the file's stated bitrate (may vary between streams, probably applies to just video if a video file)
 * @property {number} probe_score A score of how confident FFprobe is of the format, 0 to 100. https://stackoverflow.com/questions/25257986/what-does-probe-score-mean-in-ffprobe-output
 * @property {FFprobeFormatTags} [tags] The format's tags
 */

/**
 * @typedef FFprobeProbeError
 * @property {number} code The error code
 * @property {string} string The error message
 */

/**
 * @typedef FFprobeProbeResult
 * @property {Array<FFprobeStream>} [streams] The probed file's streams (-show_streams flag required)
 * @property {Array<FFprobeChapter>} [chapters] The probed file's chapters (-show_chapters flag required)
 * @property {FFprobeFormat} [format] The probed file's format data (-show_format flag required)
 * @property {FFprobeProbeError} [error] The error that occurred when trying to probe the file (-show_error flag required)
 */

/**
 * The "disposition" field on an FFprobe response stream object
 */
export interface FFprobeStreamDisposition {
  /**
   * 1 if the default track
   */
  default: 1 | 0,

  /**
   * 1 if a dub track
   */
  dub: 1 | 0,

  /**
   * 1 if the original track
   */
  original: 1 | 0,

  /**
   * 1 if a comment track
   */
  comment: 1 | 0,

  /**
   * 1 if a lyrics track
   */
  lyrics: 1 | 0,

  /**
   * 1 if a karaoke track
   */
  karaoke: 1 | 0,

  /**
   * 1 if a forced track
   */
  forced: 1 | 0,

  /**
   * 1 if a track for the hearing impaired
   */
  hearing_impaired: 1 | 0,

  /**
   * 1 if a track for the visually impaired
   */
  visual_impaired: 1 | 0,

  /**
   * 1 if a clean effects track
   */
  clean_effects: 1 | 0,

  /**
   * 1 if an attached picture track
   */
  attached_pic: 1 | 0,

  /**
   * 1 if a timed thumbnails track (perhaps like the preview thumbnails you get when scrolling over a YouTube video's seek bar)
   */
  timed_thumbnails: 1 | 0,

  /**
   * 1 if a captions track
   */
  captions: 1 | 0,

  /**
   * 1 if a descriptions track
   */
  descriptions: 1 | 0,

  /**
   * 1 if a metadata track
   */
  metadata: 1 | 0,

  /**
   * 1 if a dependent track (unclear meaning)
   */
  dependent: 1 | 0,

  /**
   * 1 if a still image track
   */
  still_image: 1 | 0
}

/**
 * The "tags" field on an FFprobe response stream object
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type FFprobeStreamTags = {
  /**
   * The track's language (usually represented using a 3 letter language code, e.g.: "eng")
   */
  language?: string,

  /**
   * The name of the handler which produced the track
   */
  handler_name?: string,

  /**
   * The ID of the vendor which produced the track
   */
  vendor_id?: string,

  /**
   * The name of the encoder responsible for creating the stream
   */
  encoder?: string,

  /**
   * The date (often ISO-formatted, but it may use other formats) when the media was created
   */
  creation_time?: string,

  /**
   * The comment attached to the stream
   */
  comment?: string

  rotate?: string,

  // https://github.com/mifi/lossless-cut/issues/1530
  title?: string,
} & Record<string, string>

/**
 * An FFprobe response stream object
 */
export interface FFprobeStream {
  /**
   * The stream index
   */
  index: number,

  /**
   * The codec's name
   */
  codec_name: string,

  /**
   * The codec's long (detailed) name
   */
  codec_long_name: string,

  /**
   * The codec profile
   */
  profile: string,

  /**
   * The type of codec (video, audio, subtitle, etc.)
   */
  codec_type: 'video' | 'audio' | 'subtitle' | 'attachment' | 'data',

  /**
   * The codec tag (technical name)
   */
  codec_tag_string: string,

  /**
   * The codec tag ID
   */
  codec_tag: string,

  /**
   * The audio sample format (not present if codec_type is not "audio")
   */
  sample_fmt?: string,

  /**
   * A string representation of an integer showing the audio sample rate (not present if codec_type is not "audio")
   */
  sample_rate?: string,

  /**
   * The audio track's channel count (not present if codec_type is not "audio")
   */
  channels?: number,

  /**
   * The audio track's channel layout (e.g. "stereo") (not present if codec_type is not "audio")
   */
  channel_layout?: 'stereo' | 'mono',

  /**
   * Bits per audio sample (might not be accurate, may just be 0) (not present if codec_type is not "audio")
   */
  bits_per_sample?: number,

  /**
   * The video stream width (also available for images) (not present if codec_type is not "video")
   */
  width?: number,

  /**
   * The stream height (also available for images) (not present if codec_type is not "video")
   */
  height?: number,

  /**
   * The stream's coded width (shouldn't vary from "width") (not present if codec_type is not "video")
   */
  coded_width?: number,

  /**
   * The stream's coded height (shouldn't vary from "height") (not present if codec_type is not "video")
   */
  coded_height?: number,

  /**
   * Set to 1 if closed captions are present in stream... I think (not present if codec_type is not "video")
   */
  closed_captions?: 1 | 0 | number,

  /**
   * Set to 1 if the stream has b-frames... I think (not present if codec_type is not "video")
   */
  has_b_frames?: 1 | 0 | number,

  /**
   * The sample aspect ratio (you probably want "display_aspect_ratio") (not present if codec_type is not "video")
   */
  sample_aspect_ratio?: string,

  /**
   * The display (real) aspect ratio (e.g. "16:9") (not present if codec_type is not "video")
   */
  display_aspect_ratio?: string,

  /**
   * The pixel format used (not present if codec_type is not "video")
   */
  pix_fmt?: string,

  /**
   * Unknown (not present if codec_type is not "video")
   */
  level?: number,

  /**
   * The color range used (e.g. "tv") (not present if codec_type is not "video")
   */
  color_range?: string,

  /**
   * The color space used (not present if codec_type is not "video")
   */
  color_space?: string,

  /**
   * The color transfer used (not present if codec_type is not "video")
   */
  color_transfer?: string,

  /**
   * The color primaries used (not present if codec_type is not "video")
   */
  color_primaries?: string,

  /**
   * The chroma location (not present if codec_type is not "video")
   */
  chroma_location?: string,

  /**
   * Unknown (not present if codec_type is not "video")
   */
  refs?: number,

  /**
   * Whether the stream is AVC (not present if codec_type is not "video")
   */
  is_avc?: 'true' | 'false',

  /**
   * Unknown string representing a number (not present if codec_type is not "video")
   */
  nal_length_size?: string,

  /**
   * Odd formatting of the frame rate, possibly "real frame rate"? (e.g. "30/1")
   */
  r_frame_rate: string,

  /**
   * Odd formatting of the average frame rate (e.g. "30/1")
   */
  avg_frame_rate: string,

  /**
   * The division equation to use for converting integer representations of timestamps into seconds (e.g. "1/30000" turns 80632552 into 2687.751733 seconds)
   */
  time_base: string,

  /**
   * Unknown
   */
  start_pts: number,

  /**
   * A string representation of a floating point integer showing the start time in seconds
   */
  start_time: string,

  /**
   * The stream's duration in integer timestamp format (defined by time_base)
   */
  duration_ts: number,

  /**
   * A string representation of a floating point integer showing the stream duration in seconds
   */
  duration: string,

  /**
   * The string representation of an integer showing the stream bit rate (not present on lossless formats such as FLAC)
   */
  bit_rate?: string,

  /**
   * A string representation of an integer showing the bits per raw sample (not present if codec_type is not "video")
   */
  bits_per_raw_sample?: string,

  /**
   * A string representation of an integer showing the total number of frames in the stream
   */
  nb_frames: string,

  /**
   * The stream's disposition
   */
  disposition: FFprobeStreamDisposition,

  /**
   * The stream's tags
   */
  tags?: FFprobeStreamTags
}

/**
 * The "tags" field on an FFprobe response chapter object
 */
export interface FFprobeChapterTags {
  /**
   * The chapter title
   */
  title: string
}

/**
 * An FFprobe response chapter object
 */
export interface FFprobeChapter {
  /**
   * The chapter ID
   */
  id: number,

  /**
   * The division equation to use for converting integer representations of timestamps into seconds (e.g. "1/30000" turns 80632552 into 2687.751733 seconds)
   */
  time_base: string,

  /**
   * When the chapter starts in integer timestamp format (defined by time_base)
   */
  start: number,

  /**
   * The string representation of a floating point integer showing when the chapter starts in seconds
   */
  start_time: string,

  /**
   * When the chapter end in integer timestamp format (defined by time_base)
   */
  end: number,

  /**
   * The string representation of a floating point integer showing when the chapter ends in seconds
   */
  end_time: string,

  /**
   * The chapter's tags
   */
  tags: FFprobeChapterTags
}

/**
 * The "tags" field on an FFprobe response format object
 */
export type FFprobeFormatTags = {
  /**
   * Not clear, probably the media type brand, but not sure
   */
  major_brand: string,

  /**
   * The brand version perhaps, but not sure
   */
  minor_version: string,

  /**
   * The brands that are compatible with the referenced brands perhaps, but not sure
   */
  compatible_brands: string,

  /**
   * The media's title (song metadata uses an all uppercase version)
   */
  title?: string,

  /**
   * The media artist (song metadata uses an all uppercase version)
   */
  artist?: string,

  /**
   * The media's creation date, seems to be in YYYYMMDD format (song metadata uses an all uppercase version)
   */
  date?: string,

  /**
   * The name of the encoder responsible for encoding the media
   */
  encoder?: string,

  /**
   * The comment attached to the file
   */
  comment?: string,

  /**
   * The description attached to the file
   */
  description?: string,

  /**
   * The ISO-formatted date (although it may use other formats) when the media was created
   */
  creation_time?: string,

  /**
   * The album (only present in audio files)
   */
  ALBUM?: string,

  /**
   * The album arist (only present in audio files)
   */
  album_artist?: string,

  /**
   * The album artist name used for sorting probably (only present in audio files)
   */
  ALBUMARTISTSORT?: string,

  /**
   * The song artist (only present in audio files)
   */
  ARTIST?: string,

  /**
   * The date when the song was created (no particular format, often the year) (only present in audio files)
   */
  DATE?: string,

  /**
   * The string representation of an integer showing the song's disc number (only present in audio files)
   */
  disc?: string,

  /**
   * The string representation of an integer showing the total number of discs comprising the album the song is in (only present in audio files)
   */
  DISCTOTAL?: string,

  /**
   * The song's International Standard Recording Code
   */
  ISRC?: string,

  /**
   * The song's genre (only present in audio files)
   */
  GENRE?: string,

  /**
   * The song's title (only present in audio files)
   */
  TITLE?: string,

  /**
   * The string representation of an integer showing the song's track number (only present in audio files)
   */
  track?: string,

  /**
   * The string representation of an integer showing the total number of tracks in the album the song is in (only present in audio files)
   */
  TRACKTOTAL?: string,

  /**
   * The string representation of an integer showing the year the song was created (only present in audio files)
   */
  YEAR?: string,

  /**
   * The string representation of an integer showing the song's BPM (only present in audio files)
   */
  BPM?: string,

  /**
   * The song's publisher (only present in audio files)
   */
  PUBLISHER?: string
} & Record<string, string>

/**
 * An FFprobe response format object
 */
export interface FFprobeFormat {
  /**
   * The path of the probed file (as specified in the input file argument)
   */
  filename: string,

  /**
   * The total number of streams present
   */
  nb_streams: number,

  /**
   * The total number of programs present
   */
  nb_programs: number,

  /**
   * The name of the format (a comma separated list of applicable file extensions for the format)
   */
  format_name: string,

  /**
   * The long (detailed) name of the format
   */
  format_long_name: string,

  /**
   * The string representation of a floating point integer showing the file's starting time
   */
  start_time: string,

  /**
   * The string representation of a floating point integer showing the file's duration in seconds (seems to be a non-accurate, rounded version of the real duration)
   */
  duration: string,

  /**
   * The string representation of a long integer showing the file's size in bytes
   */
  size: string,

  /**
   * The string representation of a long integer showing the file's stated bitrate (may vary between streams, probably applies to just video if a video file)
   */
  bit_rate: string,

  /**
   * A score of how confident FFprobe is of the format, 0 to 100. https://stackoverflow.com/questions/25257986/what-does-probe-score-mean-in-ffprobe-output
   */
  probe_score: number,

  /**
   * The format's tags
   */
  tags?: FFprobeFormatTags
}

/**
 * An FFprobe error object
 */
export interface FFprobeProbeError {
  /**
   * The error code
   */
  code: number,

  /**
   * The error message
   */
  string: string
}

/**
 * An FFprobe probe result object
 */
export interface FFprobeProbeResult {
  /**
   * The probed file's streams (-show_streams flag required)
   */
  streams?: FFprobeStream[],

  /**
   * The probed file's chapters (-show_chapters flag required)
   */
  chapters?: FFprobeChapter[],

  /**
   * The probed file's format data (-show_format flag required)
   */
  format?: FFprobeFormat,

  /**
   * The error that occurred when trying to probe the file (-show_error flag required)
   */
  error?: FFprobeProbeError
}
