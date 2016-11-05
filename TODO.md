## TODO / ideas
- Visual feedback on button presses
- support for previewing other formats by streaming through ffmpeg?
- Slow scrub with modifier key
- show frame number (approx?)
- ffprobe show keyframes (pprobe -of json -select_streams v -show_frames file.mp4)
- cutting out the commercials in a video file while saving the rest to a single file?
- With the GOP structure of h.264 you could run into some pretty nasty playback issues without re-encoding if you cut the wrong frames out.
- Shortcut Cmd+o also triggers o (cut end)
- implement electron app event "open-file"
- Travis github deploys https://docs.travis-ci.com/user/deployment
- react video ref="video" this.refs.video.play()
- A dedicated "Options" menu where the users can set a default output folder for captured frames and for cut videos will also be handy, now lossless-cut uses the input folder.

## Links
- http://apple.stackexchange.com/questions/117306/what-options-are-available-to-losslessly-trim-mp4-m4v-video-on-10-8-or-above
- http://superuser.com/questions/554620/how-to-get-time-stamp-of-closest-keyframe-before-a-given-timestamp-with-ffmpeg/554679#554679
- http://www.fame-ring.com/smart_cutter.html
- http://electron.atom.io/apps/
- https://github.com/electron/electron/blob/master/docs/api/file-object.md
- https://github.com/electron/electron/issues/2538
