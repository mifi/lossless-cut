# Agent instructions

## Commits

If a commit changes user-visible behaviour (a fix, feature, or behaviour change a user would notice), add a `Changelog:` line to the end of the commit message (e.g. with the other trailers), describing the impact for users in one line. Omit it for internal changes (refactors, tests, CI, dependency bumps).

```
Validate --settings-json with zod

...

Changelog: `--settings-json` is now validated; invalid input is logged and ignored instead of being written to the config
```

These are collected when releasing, see [RELEASING.md](./RELEASING.md).

## FFmpeg

Only the bundled FFmpeg version (`script/downloadFfmpeg.ts`) is supported. Don't add or keep code for compatibility with older FFmpeg versions (e.g. old option names or log formats). When upgrading FFmpeg, remove such code.

## Releasing

When helping with a release, follow [RELEASING.md](./RELEASING.md), including the sections written for agents (store release notes, release announcement).

Never submit to a store, publish a release or post an announcement without the user's approval of the exact text first.

## Feature media

`script/featureMedia.ts` records screenshots and a short video of a feature demo, for social media posts and the website. Each demo is a scenario in `script/featureMedia/scenarios.ts` that drives the app through the HTTP API. It runs on Linux under Xvfb (e.g. in a cloud session):

```bash
yarn build && yarn download-ffmpeg-linux-x64
# If missing: apt-get install xvfb xdotool fonts-inter
xvfb-run -a -s "-screen 0 1024x640x24" node script/featureMedia.ts cut-segments
```

The clips come from `dist/feature-media-clips`. Missing ones are made from free sources with an ffmpeg stream copy (`script/featureMedia/clips.ts`, which only downloads the part that's needed) or downloaded from https://static.mifi.no/losslesscut (or `FEATURE_MEDIA_CLIPS_URL`; behind a proxy, e.g. in a cloud session, set `NODE_USE_ENV_PROXY=1`). For a new clip, prefer a free source in `clips.ts` (its host must be allowed by the network policy), or ask the user to upload it. `tears-of-steel.mkv` is an excerpt of [Tears of Steel](https://mango.blender.org/), which is CC BY 3.0, so posts that show it must credit "Tears of Steel (CC) Blender Foundation | mango.blender.org". The results go to `dist/feature-media`. Failed actions don't fail the script, so look at the screenshots (and `<scenario>-app.log`) to check that the demo did what it should. Never commit clips or results.

Each demo makes a plain master (`<scenario>.mp4`, for the website) and social media versions with the scenario's captions and zooms and an intro and outro card (`<scenario>-landscape.mp4`, and `<scenario>-vertical.mp4` for Reels, TikTok and Shorts). They have music: by default a track from `script/featureMedia/music.ts` (pick another with `--music <name>`, use an audio file, or `--music none`). The script prints the credit the track needs; add it to the post, e.g. `Music: "Werq" by Kevin MacLeod (incompetech.com), CC BY 4.0`. For sharp screenshots (e.g. for the website), record with `--scale 2` and Xvfb at `-screen 0 2048x1280x24`: the app is drawn at twice the pixels, and scenarios use the same coordinates.

When a user-visible feature lands on master, suggest adding a scenario for it and recording it.
