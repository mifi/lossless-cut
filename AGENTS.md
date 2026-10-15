# Agent instructions

## Commits

If a commit changes user-visible behaviour (a fix, feature, or behaviour change a user would notice), add a `Changelog:` trailer to the commit message, describing the impact for users in one line. Omit it for internal changes (refactors, tests, CI, dependency bumps).

```
Validate --settings-json with zod

...

Changelog: `--settings-json` is now validated; invalid input is logged and ignored instead of being written to the config
```

When preparing a release, run `yarn release-notes` to collect these since the last tag, and use them to write `versions/<version>.md` (shown in the app's What's New dialog) and the GitHub release notes.
