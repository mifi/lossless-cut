# Agent instructions

## Commits

If a commit changes user-visible behaviour (a fix, feature, or behaviour change a user would notice), add a `Changelog:` line to the end of the commit message (e.g. with the other trailers), describing the impact for users in one line. Omit it for internal changes (refactors, tests, CI, dependency bumps).

```
Validate --settings-json with zod

...

Changelog: `--settings-json` is now validated; invalid input is logged and ignored instead of being written to the config
```

When preparing a release, run `yarn release-notes` to collect these since the last tag, and use them to write `versions/<version>.md` (shown in the app's What's New dialog) and the GitHub release notes.

## FFmpeg

Only the bundled FFmpeg version (`script/downloadFfmpeg.ts`) is supported. Don't add or keep code for compatibility with older FFmpeg versions (e.g. old option names or log formats). When upgrading FFmpeg, remove such code.

## Store release notes

The stores lag behind GitHub releases, so their "What's new" text must cover every version since the one currently live in that store. Ask which version that is (Mac App Store: App Store Connect; Microsoft Store: Partner Center → the product's current submission → Packages), then combine `versions/*.md` after it up to the version being released. Mac App Store versions have their own numbering (1.x); the GitHub version is that of the build attached to it.

- Write for customers: lead with the most impactful new features and visible fixes. Leave out internals (dependency/FFmpeg upgrades, security fixes, refactors) and niche power-user details; they're covered by a final "Many other improvements and fixes". The longer since the last store release, the more of the interesting changes can be included.
- Plain text, no Markdown, code formatting, issue references or links. Use plain-language feature names instead of internal action/variable names.
- Leave out what doesn't apply to that store's build: items for other platforms (App Review rejects mentions of other platforms), GitHub-only builds, custom FFmpeg path (not in the Mac App Store build), update checks.
- Microsoft Store: max 1500 characters. Mac App Store: max 4000 characters.
- Write them to `store-release-notes/mas-<version>.txt` and `store-release-notes/msstore-<version>.txt`, where `script/storeRelease.ts` reads them, and ask the user to review them before committing. Only run the script with `--prepare` or `--submit` (or the Store release workflow with "submit") after the user approves the text and the dry-run output.

## Release announcement

After a GitHub release is published, draft one post per channel from `versions/<version>.md` and the release link, and show them to me before posting:

| Channel | Where | Limit |
|---|---|---|
| Discord | the announcements channel of https://discord.gg/fhnEREfUJ3 | 2000 chars |
| X | https://x.com/losslesscut (then repost from @mifi_no) | 280 chars |
| Bluesky | https://bsky.app/profile/losslesscut.app | 300 chars |
| Mastodon | https://mastodon.social/@losslesscut | 500 chars |

- Start with "LosslessCut x.y.z is out", then the 1–3 most interesting changes for users, then the release link (https://github.com/mifi/lossless-cut/releases/tag/vx.y.z). Discord can take the full list.
- Plain text, no issue references. A patch release that only fixes one platform can be a single line.
- Post through my logged-in browser (Claude's browser automation or the built-in browser). Fill in the post and let me confirm before clicking Post.
