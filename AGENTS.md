# Agent instructions

## Commits

If a commit changes user-visible behaviour (a fix, feature, or behaviour change a user would notice), add a `Changelog:` line to the end of the commit message (e.g. with the other trailers), describing the impact for users in one line. Omit it for internal changes (refactors, tests, CI, dependency bumps).

```
Validate --settings-json with zod

...

Changelog: `--settings-json` is now validated; invalid input is logged and ignored instead of being written to the config
```

When preparing a release, run `yarn release-notes` to collect these since the last tag, and use them to write `versions/<version>.md` (shown in the app's What's New dialog) and the GitHub release notes.

If a commit adds a visual or especially interesting feature (one that's easy to show in a screenshot or a few seconds of video), remind the user, once it's merged to master, to post about it (see [Feature post](#feature-post)).

## Features list

[`docs/features.md`](docs/features.md) is the full list of features and example use cases (https://losslesscut.app/docs/features). When a commit adds a user-visible feature, or changes or removes one, update it in the same commit, in the matching section. The README (`## Features`) and the homepage (`features` in `website/src/components/Home.tsx`) only show the same 9 highlights: if the new feature is one of the most important for new users, suggest to the user whether it should replace one of them, and keep the two in sync. When adding a language to `langNames` (`src/common/i18n.ts`), update the language count in `docs/features.md` and on the homepage.

## FFmpeg

Only the bundled FFmpeg version (`script/downloadFfmpeg.ts`) is supported. Don't add or keep code for compatibility with older FFmpeg versions (e.g. old option names or log formats). When upgrading FFmpeg, remove such code.

## Store release notes

The stores lag behind GitHub releases, so their "What's new" text must cover every version since the one currently live in that store. Ask which version that is (Mac App Store: App Store Connect; Microsoft Store: Partner Center → the product's current submission → Packages), then combine `versions/*.md` after it up to the version being released. Mac App Store versions have their own numbering (1.x); the GitHub version is that of the build attached to it.

- Write for customers: lead with the most impactful new features and visible fixes. Leave out internals (dependency/FFmpeg upgrades, security fixes, refactors) and niche power-user details; they're covered by a final "Many other improvements and fixes". The longer since the last store release, the more of the interesting changes can be included.
- Plain text, no Markdown, code formatting, issue references or links. Use plain-language feature names instead of internal action/variable names.
- Leave out what doesn't apply to that store's build: items for other platforms (App Review rejects mentions of other platforms), GitHub-only builds, custom FFmpeg path (not in the Mac App Store build), update checks.
- Microsoft Store: max 1500 characters. Mac App Store: max 4000 characters.
- Write them to `store-release-notes/mas-<version>.txt` and `store-release-notes/msstore-<version>.txt`, where `script/storeRelease.ts` reads them, and ask the user to review them before committing. Only run the script with `--prepare` or `--submit` (or the Store release workflow with "submit") after the user approves the text and the dry-run output.

## Feature post

When a visual or especially interesting feature lands in master, suggest a short post about just that feature. Use the channels, character limits, hashtags and posting steps of the [Release announcement](#release-announcement), but start with the feature instead of a version number, and attach the user's screenshot or clip instead of a release image:

- Ask the user to make a screenshot or a short silent screen recording (about 10 seconds) that shows it.
- Say that people can try it now in the latest nightly build (https://mifi.no/llc/nightly/), and that it will be in the next release.
- Such a clip can also become the homepage's demo (`website/src/assets/home/demo.mp4`, shown in the hero instead of the screenshot).

## Release announcement

After a GitHub release is published, draft one post per channel from `versions/<version>.md` and the release link, and show them to the user before posting:

| Channel | Where | Limit |
|---|---|---|
| Discord | #general of https://discord.gg/fhnEREfUJ3 (there's no announcements channel) | 2000 chars |
| X | https://x.com/losslesscut (then repost from @mifi_no) | 280 chars |
| Bluesky | https://bsky.app/profile/losslesscut.app | 300 chars |
| Mastodon | https://mastodon.social/@losslesscut | 500 chars |
| Instagram | https://www.instagram.com/losslesscut.app/ (Create → Post on the website) | 2200 chars, links aren't clickable: say "link in bio" |

- Start with "LosslessCut x.y.z is out", then the 1–3 most interesting changes for users, then the release link (https://github.com/mifi/lossless-cut/releases/tag/vx.y.z). Discord can take the full list.
- Plain text, no issue references. The link counts toward the limit (on X and Mastodon as 23 chars). A patch release that only fixes one platform can be a single line.
- Hashtags go at the end, in CamelCase (readable for screen readers), and count toward the limit. They matter most on Mastodon, which has no recommendation algorithm, so people find posts by following hashtags: use 3–4, e.g. `#LosslessCut #FFmpeg #VideoEditing #OpenSource`. Bluesky: 1–2 (`#LosslessCut #OpenSource`). Instagram: 3–5. X: at most `#LosslessCut`. Discord: none.
- Post to all channels by default.
- Attach an image made with `node script/releaseImage.ts <version> [--bg photo.jpg] [--position top|bottom|left|right|center] [--caption "..."] [--square] "highlight 1" "highlight 2" "highlight 3"` (1600×900 PNG in `dist/`, or 1080×1080 with `--square`, e.g. for Instagram). Ask the user for a recent photo of theirs to use as the background (optional) and a short caption for it (where/what, shown small in the corner). The photo is cropped to keep its most interesting part; look at the result, and if the subject is cut off (e.g. a portrait photo) or hidden behind the text, try `--position` (top/bottom for a portrait photo, left/right for a wide one). Keep highlights short so they fit on one line. Never commit the photo or the image. Add alt text, e.g. "LosslessCut 3.70.1: <highlights>".
  - Phone photos are often HEIC: convert with `sips -s format jpeg photo.HEIC --out photo.jpg` (sharp can't read HEIC). Files in `~/Downloads` may not be readable from the shell (macOS privacy protection); ask the user to move the photo to the Desktop.
  - `--position` only moves the crop along the axis that gets cut, so a 4:3 photo in the 16:9 image can only move up/down. If the subject still ends up behind the text, crop the photo first (e.g. with sharp's `extract`) so the subject sits in the right half.
- Post through the user's logged-in browser. Fill in the post and let the user confirm before clicking Post.
  - The built-in browser can't pick files in the upload dialog: copy the images to the Desktop with clear names (e.g. `losslesscut-3.70.1.png`, `losslesscut-3.70.1-square.png`), click the platform's attach button, and ask the user to pick the file.
  - Bluesky turns a typed URL into a link card and removes it from the text, and an attached image replaces the card. After attaching the image, check that the link is still in the text, and type it again at the end if not.
  - Discord sends on Enter, and typing a long multi-line message into it in the built-in browser drops lines. Put the message on the clipboard with `pbcopy`, ask the user to paste it into the message box with Cmd+V, and check the box before sending.
  - After posting, open the profile and note the post's URL.
  - After the X post, remind the user to repost it from their personal account @mifi_no (it's usually not signed in in the built-in browser, so the user does it). Check the post's reposts list (`/status/<id>/retweets`) to confirm.
