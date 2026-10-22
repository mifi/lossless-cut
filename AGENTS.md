# Agent instructions

## Commits

If a commit changes user-visible behaviour (a fix, feature, or behaviour change a user would notice), add a `Changelog:` line to the end of the commit message (e.g. with the other trailers), describing the impact for users in one line. Omit it for internal changes (refactors, tests, CI, dependency bumps).

```
Validate --settings-json with zod

...

Changelog: `--settings-json` is now validated; invalid input is logged and ignored instead of being written to the config
```

These are collected when releasing, see [RELEASING.md](./RELEASING.md).

If a commit adds a visual or especially interesting feature (one that's easy to show in a screenshot or a few seconds of video), remind the user, once it's merged to master, to post about it (see [Feature post](#feature-post)).

## Features list

[`docs/features.md`](docs/features.md) is the full list of features and example use cases (https://losslesscut.app/docs/features). When a commit adds a user-visible feature, or changes or removes one, update it in the same commit, in the matching section. The README (`## Features`) and the homepage (`features` in `website/src/components/Home.tsx`) only show the same 9 highlights: if the new feature is one of the most important for new users, suggest to the user whether it should replace one of them, and keep the two in sync. When adding a language to `langNames` (`src/common/i18n.ts`), update the language count in `docs/features.md` and on the homepage.

## FFmpeg

Only the bundled FFmpeg version (`script/downloadFfmpeg.ts`) is supported. Don't add or keep code for compatibility with older FFmpeg versions (e.g. old option names or log formats). When upgrading FFmpeg, remove such code.

## Releasing

When helping with a release, follow [RELEASING.md](./RELEASING.md), including the sections written for agents (store release notes, release announcement).

Never submit to a store, publish a release or post an announcement without the user's approval of the exact text first.

## Feature post

When a visual or especially interesting feature lands in master, suggest a short post about just that feature. Use the channels, character limits, hashtags and posting steps of the [release announcement](./RELEASING.md#release-announcement), but start with the feature instead of a version number, and attach the user's screenshot or clip instead of a release image:

- Ask the user to make a screenshot or a short silent screen recording (about 10 seconds) that shows it.
- Say that people can try it now in the latest nightly build (https://mifi.no/llc/nightly/), and that it will be in the next release.
- Such a clip can also become the homepage's hero video (1024×640, silent, with a still of its first frame as the poster): upload it to static.mifi.no and update `heroVideo` in `website/src/images.ts`.
