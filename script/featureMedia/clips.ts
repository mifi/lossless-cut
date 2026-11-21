// Clips that script/featureMedia.ts makes from their free sources instead of downloading them from static.mifi.no.
// Each is the ffmpeg arguments (before the output path) for a lossless stream copy, which only downloads the part that's needed.

// An excerpt (00:20–01:05) of Tears of Steel, CC BY 3.0, (CC) Blender Foundation | mango.blender.org
// with its stereo and 5.1 mixes and 6 subtitle tracks. The start is a keyframe, so the stream copy starts cleanly
const tearsOfSteel = 'https://download.blender.org/demo/movies/ToS';
const tearsOfSteelStart = '19.833333';
const tearsOfSteelSubtitles = [['en', 'eng', 'English'], ['de', 'ger', 'Deutsch'], ['es', 'spa', 'Español'], ['fr-orig', 'fre', 'Français'], ['no', 'nor', 'Norsk'], ['JP', 'jpn', '日本語']] as const;

const clipSources: Record<string, string[]> = {
  'tears-of-steel.mkv': [
    ...[`${tearsOfSteel}/tears_of_steel_720p.mov`, `${tearsOfSteel}/Surround-TOS_DVDSURROUND-Dolby%205.1.ac3`, ...tearsOfSteelSubtitles.map(([file]) => `${tearsOfSteel}/subtitles/TOS-${file}.srt`)]
      .flatMap((url) => ['-ss', tearsOfSteelStart, '-i', url]),
    '-t', '45',
    '-map', '0:v', '-map', '0:a', '-map', '1:a', ...tearsOfSteelSubtitles.flatMap((_, i) => ['-map', `${i + 2}:s`]),
    '-c', 'copy', '-c:s', 'srt',
    '-metadata:s:a:0', 'title=Stereo', '-metadata:s:a:1', 'language=eng', '-metadata:s:a:1', 'title=5.1 surround',
    ...tearsOfSteelSubtitles.flatMap(([, language, title], i) => [`-metadata:s:s:${i}`, `language=${language}`, `-metadata:s:s:${i}`, `title=${title}`]),
    '-disposition:s:0', 'default',
    '-f', 'matroska',
  ],
};

export default clipSources;
