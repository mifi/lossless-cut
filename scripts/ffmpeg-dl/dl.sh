#!/usr/bin/env bash
ffmpeg_linux_ia32=https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-32bit-static.tar.xz
ffmpeg_linux_x64=https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-64bit-static.tar.xz
ffmpeg_darwin_x64=http://evermeet.cx/ffmpeg/ffmpeg-3.4.1.7z
ffmpeg_win32_ia32=https://ffmpeg.zeranoe.com/builds/win32/static/ffmpeg-3.4.1-win32-static.zip
ffmpeg_win32_x64=https://ffmpeg.zeranoe.com/builds/win64/static/ffmpeg-3.4.1-win64-static.zip
ffprobe_darwin_x64=http://evermeet.cx/ffmpeg/ffprobe-3.4.1.7z

OUT_DIR=ffmpeg-tmp/archives

if [ -d "$OUT_DIR" ]; then
  echo "$OUT_DIR exists, skipping download."
  exit
fi

mkdir -p "$OUT_DIR" &&
(cd "$OUT_DIR" &&
wget -O ffmpeg_linux_ia32.tar.xz "${ffmpeg_linux_ia32}" &&
wget -O ffmpeg_linux_x64.tar.xz "${ffmpeg_linux_x64}" &&
wget -O ffmpeg_darwin_x64.7z "${ffmpeg_darwin_x64}" &&
wget -O ffmpeg_win32_ia32.zip "${ffmpeg_win32_ia32}" &&
wget -O ffmpeg_win32_x64.zip "${ffmpeg_win32_x64}" &&
wget -O ffprobe_darwin_x64.7z "${ffprobe_darwin_x64}")
