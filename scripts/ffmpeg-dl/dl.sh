#!/usr/bin/env bash
ffmpeg_version=4.2

ffmpeg_linux_x64=https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
ffmpeg_darwin_x64=https://evermeet.cx/ffmpeg/ffmpeg-"${ffmpeg_version}".7z
ffmpeg_win32_ia32=https://ffmpeg.zeranoe.com/builds/win32/static/ffmpeg-"${ffmpeg_version}"-win32-static.zip
ffmpeg_win32_x64=https://ffmpeg.zeranoe.com/builds/win64/static/ffmpeg-"${ffmpeg_version}"-win64-static.zip
ffprobe_darwin_x64=http://evermeet.cx/ffmpeg/ffprobe-"${ffmpeg_version}".7z

OUT_DIR=ffmpeg-tmp/archives

if test "$(ls -A "$OUT_DIR" 2>/dev/null)"; then
  echo "$OUT_DIR exists, skipping download."
  exit
fi

mkdir -p "$OUT_DIR" &&
(cd "$OUT_DIR" &&
wget -O ffmpeg_linux_x64.tar.xz "${ffmpeg_linux_x64}" &&
wget -O ffmpeg_darwin_x64.7z "${ffmpeg_darwin_x64}" &&
wget -O ffmpeg_win32_ia32.zip "${ffmpeg_win32_ia32}" &&
wget -O ffmpeg_win32_x64.zip "${ffmpeg_win32_x64}" &&
wget -O ffprobe_darwin_x64.7z "${ffprobe_darwin_x64}")
