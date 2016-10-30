# LosslessCut
Cross platform GUI tool for lossless trimming / cutting of videos using ffmpeg and electron. Great for rough processing of large video files taken from a video camera, drone, etc. Lets you quickly get rid of the useless parts. It doesn't do any decoding / encoding and is therefore very fast and has no quality loss. Also allows for taking JPEG snapshots of the video at the selected time.

![Demo](demo.gif)

## Download


## Installing / running

- Install [ffmpeg](https://www.ffmpeg.org/download.html)
- Download [latest LosslessCut from releases](https://github.com/mifi/lossless-cut/releases)
- Run app
- If ffmpeg is available in <b>$PATH</b>/<b>%PATH%</b> it will just work  
- If not, a dialog will pop up to select ffmpeg executable path.

## Documentation

Drag drop a video file into player to load or use <kbd>⌘</kbd>/<kbd>CTRL</kbd>+<kbd>O</kbd>. Select the start and end time and press the scissors button. The original video files will not be modified. Instead it creates a lossless export in the same directory as the original file. Preserves exif data.

### Keyboard shortcuts
- <kbd>SPACE</kbd> Play/pause
- <kbd>←</kbd> Seek backward 1 sec
- <kbd>→</kbd> Seek forward 1 sec
- <kbd>.</kbd> (period) Tiny seek forward
- <kbd>,</kbd> (comma) Tiny seek backward
- <kbd>c</kbd> Capture snapshot (in the same dir as the video)

## Development building / running

```
git clone https://github.com/mifi/lossless-cut.git
cd lossless-cut
npm install
```

### Running
```
npm start
```

### Building package
```
npm run build
npm run package
```

## TODO
- more hotkeys
- ffprobe show keyframes?
- ffprobe format
- About menu
- improve ffmpeg error handling
- timeline scrub support

## Links
- http://apple.stackexchange.com/questions/117306/what-options-are-available-to-losslessly-trim-mp4-m4v-video-on-10-8-or-above
- https://www.google.no/webhp?sourceid=chrome-instant&ion=1&espv=2&ie=UTF-8#q=lossless%20cut%20video
- https://github.com/electron/electron/blob/master/docs/api/file-object.md
- https://github.com/electron/electron/issues/2538
