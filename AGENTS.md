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

The stores lag behind GitHub releases, so their "What's new" text must cover every version since the one currently live in that store. Ask which version that is (Mac App Store: App Store Connect; Microsoft Store: Partner Center → the product's current submission → Packages), then combine `versions/*.md` after it up to the version being released.

- Plain text, no Markdown, code formatting, issue references or links. Use plain-language feature names instead of internal action/variable names.
- Leave out what doesn't apply to that store's build: items for other platforms (App Review rejects mentions of other platforms), GitHub-only builds, custom FFmpeg path (not in the Mac App Store build), update checks.
- Microsoft Store: max 1500 characters. Mac App Store: max 4000 characters.
