#!/usr/bin/env bash
ffmpeg_version=4.1.3

(
  mkdir -p ffmpeg-tmp/extracted &&
  cd ffmpeg-tmp/extracted &&
  (mkdir -p linux_x64 && cd linux_x64 &&
  7z x ../../archives/ffmpeg_linux_x64.tar.xz && tar xvfp ffmpeg_linux_x64.tar) &&
  (mkdir -p win32_ia32 && cd win32_ia32 &&
  unzip ../../archives/ffmpeg_win32_ia32.zip) &&
  (mkdir -p win32_x64 && cd win32_x64 &&
  unzip ../../archives/ffmpeg_win32_x64.zip) &&
  (mkdir -p darwin_x64 && cd darwin_x64 &&
  7z x ../../archives/ffmpeg_darwin_x64.7z &&
  7z x ../../archives/ffprobe_darwin_x64.7z)
) &&
cd ffmpeg-tmp &&
mkdir -p binaries/linux_x64 &&
mkdir -p binaries/win32_ia32 &&
mkdir -p binaries/win32_x64 &&
mkdir -p binaries/darwin_x64 &&
ls -R extracted &&
mv extracted/linux_x64/ffmpeg-"${ffmpeg_version}"-amd64-static/ffmpeg binaries/linux_x64 &&
mv extracted/linux_x64/ffmpeg-"${ffmpeg_version}"-amd64-static/ffprobe binaries/linux_x64 &&
mv extracted/win32_ia32/ffmpeg-"${ffmpeg_version}"-win32-static/bin/ffmpeg.exe binaries/win32_ia32 &&
mv extracted/win32_ia32/ffmpeg-"${ffmpeg_version}"-win32-static/bin/ffprobe.exe binaries/win32_ia32 &&
mv extracted/win32_x64/ffmpeg-"${ffmpeg_version}"-win64-static/bin/ffmpeg.exe binaries/win32_x64 &&
mv extracted/win32_x64/ffmpeg-"${ffmpeg_version}"-win64-static/bin/ffprobe.exe binaries/win32_x64 &&
mv extracted/darwin_x64/ffmpeg binaries/darwin_x64 &&
mv extracted/darwin_x64/ffprobe binaries/darwin_x64 &&
echo Done
