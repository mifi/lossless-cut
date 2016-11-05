ffmpeg_linux_ia32=https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-32bit-static.tar.xz
ffmpeg_linux_x64=https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-64bit-static.tar.xz
ffmpeg_darwin_x64=http://evermeet.cx/ffmpeg/ffmpeg-3.2.7z
ffmpeg_win32_ia32=https://ffmpeg.zeranoe.com/builds/win32/static/ffmpeg-3.1.5-win32-static.zip
ffmpeg_win32_x64=https://ffmpeg.zeranoe.com/builds/win64/static/ffmpeg-3.1.5-win64-static.zip
ffprobe_darwin_x64=http://evermeet.cx/ffmpeg/ffprobe-3.2.7z

mkdir -p ffmpeg-tmp/archives &&
(cd ffmpeg-tmp/archives &&
wget -O ffmpeg_linux_ia32.tar.xz "${ffmpeg_linux_ia32}" &&
wget -O ffmpeg_linux_x64.tar.xz "${ffmpeg_linux_x64}" &&
wget -O ffmpeg_darwin_x64.7z "${ffmpeg_darwin_x64}" &&
wget -O ffmpeg_win32_ia32.zip "${ffmpeg_win32_ia32}" &&
wget -O ffmpeg_win32_x64.zip "${ffmpeg_win32_x64}" &&
wget -O ffprobe_darwin_x64.7z "${ffprobe_darwin_x64}")
