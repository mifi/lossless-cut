/**
 * Picks the actual start time from a list of keyframes for a lossless keyframe cut at `desiredCutFrom`.
 *
 * With keyframe cut enabled and `-ss` placed before `-i`, ffmpeg seeks to the keyframe at or before the cut point,
 * so the output starts earlier than requested. The embedded timecode must be based on that actual first frame to
 * stay in sync with the video, otherwise the timecode would be ahead of the content.
 *
 * Falls back to `desiredCutFrom` when no keyframe exists at or before it (or the cut is already on a keyframe).
 */
// eslint-disable-next-line import/prefer-default-export
export function pickActualCutStart(keyframes: { time: number }[], desiredCutFrom: number) {
  const previousKeyframe = keyframes.findLast((keyframe) => keyframe.time <= desiredCutFrom);
  if (previousKeyframe && previousKeyframe.time < desiredCutFrom) return previousKeyframe.time;
  return desiredCutFrom;
}
