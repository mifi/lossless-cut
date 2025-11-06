const versions: { version: string, highlights?: string[] }[] = [
  {
    version: '3.66.1',
    highlights: [
      '‼️ Upgraded Electron to 38 - They dropped support for macOS 11',
      '🆕 Markers: Segments that don\'t have any end time are now considered "markers". They are rendered differently, and are excluded from exports. Markers can be useful for bookmarking locations on the timeline and all markers can be batch exported as screenshots.',
      '🔈 Play multiple audio tracks simultaneously (with FFmpeg-assisted playback)',
      '✅ Remember segment selected/deselected state inside .llc file',
      '💿 Split timeline by byte size',
      'Upgraded FFmpeg to 8.0',
    ],
  },
  {
    version: '3.64.0',
  },
];

export default versions;
