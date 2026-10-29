# Releasing

Overview, in order:

0. Consider the [Maintenance chores](./CONTRIBUTING.md#maintenance-chores) first.
1. [Prepare and build new version](#prepare-and-build-new-version): release notes, version bump, tag.
2. [Release built version](#release-built-version): check the draft, then publish it on GitHub.
3. [After releasing in GitHub](#after-releasing-in-github): snap, [release announcement](#release-announcement).
4. [Release in Stores](#release-in-stores), some time after the GitHub release, once no serious regressions have been reported, with [store release notes](#store-release-notes).
5. [After releasing existing GitHub version in Stores](#after-releasing-existing-github-version-in-stores): move the store branch.

The branches `apple-store` and `ms-store` point to the version that's currently live in the Mac App Store and the Microsoft Store. They're for store-only hotfixes: a fix on top of the version that's in a store, without releasing everything that's on `master`.

## Prepare and build new version

- `git checkout master`
- `git merge apple-store ms-store` (in case there's an unmerged store hotfix)
- **Prepare release notes**: `yarn release-notes` lists the `Changelog:` lines from commits since the last tag (see [AGENTS.md](./AGENTS.md#commits)). Older commits don't have them, so also go through `node script/getCommits.ts`.
- Create a new file `versions/x.y.z.md` (shown in the app's What's New dialog) and write the most important highlights from the release notes, but **remove github issue #references**. The dialog shows the same text on every platform, store builds too, so leave out niche platform-specific items (keep them in the GitHub release notes); an important one gets a prefix like `(Windows)`.
- `node script/generateVersions.ts && git add versions/*.md src/renderer/src/versions.json && git commit -m 'Update change log'`
- *If Store-only hotfix release*
  - `git checkout apple-store` (or `ms-store`), commit the fix there
  - `npm version patch`
- *If normal GitHub-first release*
  - `npm version minor && git --no-pager show` (`patch` for a release with only fixes; dropping support for an OS version or architecture is always `minor`)
- `git push --follow-tags`
- The maintainer does the version bump, tag and push locally, because release tags are GPG-signed. An agent can prepare and commit the release notes, and check the build afterwards.
- Wait for build and draft in GitHub Actions. After a tag build, the `check-release-assets` job fails if an asset is missing or more than 10% smaller than in the latest release (e.g. a build without ffmpeg); check it before publishing

## Release built version

- Optionally, install the Mac App Store build from TestFlight (it shows up in App Store Connect after processing) and check that it starts and can open and export a file. This catches problems that only happen in the sandboxed MAS build.
- Open draft in GitHub and add the prepared release notes. For a patch release, end them with `See [x.y.0](https://github.com/mifi/lossless-cut/releases/tag/vx.y.0) for the full list of changes.`
  - Agents can't create, edit or publish GitHub releases from a Claude Code session (the API refuses it), so the maintainer pastes the notes and publishes.
- *If GitHub release*
  - Release the draft
- *If Store-only hotfix release*
  - Remove all other artifacts and release the draft as **pre-release**

## After releasing in GitHub

- *If Store-only hotfix release*
  - `git checkout master`
  - `git merge apple-store` (or `ms-store`)
- Bump [snap version](https://snapcraft.io/losslesscut/releases)
- Post the announcement to Discord, X, Bluesky, Mastodon and Instagram (see [Release announcement](#release-announcement))

## Release in Stores

Usually some time after the GitHub release, once no serious regressions have been reported.

This is automated with [`script/storeRelease.ts`](./script/storeRelease.ts), run by the [Store release](https://github.com/mifi/lossless-cut/actions/workflows/store-release.yml) workflow (or locally, see below):

1. Write the "What's new" text for each store (see [Store release notes](#store-release-notes)) to `store-release-notes/mas-x.y.z.txt` and `store-release-notes/msstore-x.y.z.txt`, review it, commit and push.
2. Actions → Store release → Run workflow, with command `mas` or `msstore`, version `x.y.z` and "submit" unticked. The log shows the current state and what it would change.
3. If that looks right, run it again with "submit" ticked.
4. Once approved/certified (you'll get an email):
   - **Mac App Store**: click "Release this version" in [App Store Connect](https://appstoreconnect.apple.com/apps/1505323402/distribution). The 7-day phased release then runs by itself.
   - **Microsoft Store**: click "Publish now" in [Partner Center](https://partner.microsoft.com/en-us/dashboard/products/9P30LSR4705L/overview). The rollout starts at 0%, and the workflow's daily schedule increases it to 1, 2, 5, 10, 20, 50 and 100% (finalized). To pause it, halt the rollout in Partner Center (the schedule then leaves it alone), or set a percentage yourself with the `msstore-rollout` command.

What the script does:

- **Mac App Store**: App Store versions have their own numbering (1.x, e.g. 1.14), separate from the GitHub/build version (`package.json`, e.g. 3.70.1), which is the build attached to it. The script takes the build version, and creates the next App Store version (1.14 → 1.15) or reuses the editable one. It waits for the build to finish processing and attaches it, sets en-US "What's New", the privacy policy URL (from `src/common/websiteUrls.ts`), manual release, 7-day phased release, and submits for review.
- **Microsoft Store**: creates a submission, replaces the packages with both `.appx` files from the GitHub release (renamed without `-DONT-USE-THIS-FILE`), sets en-US "What's new", gradual rollout at 0%, "Don't publish until I select Publish now", and submits for certification. Don't edit a submission in Partner Center that the script created, or the API can no longer change it.
- If the version is already submitted or released, it says so and does nothing.
- It stops before changing anything when a store isn't ready for a new version: Mac App Store while another version is in review or waiting to be released, Microsoft Store while another submission is pending or the previous gradual rollout hasn't finished (finalize it with `msstore-rollout 100`, or halt it). A dry run goes on and prints `BLOCKED` where a real run would stop.
- When such a waiting version or submission is an older build: if it doesn't have a regression on that platform, release it (and move the store branch), and the next store release can come later; otherwise remove it. Mac App Store: in App Store Connect, release it, or remove it from review (then it's rejected, and the script reuses that version number for the new build). In 3.70.2's case, a version waiting for release only offered "Release This Version". Microsoft Store: delete the submission in Partner Center (cancel the certification first if it's still in certification). Releasing an older Microsoft Store submission starts its gradual rollout, which blocks the next one until the rollout finishes (or `msstore-rollout 100`). The script copies the last *published* submission, so edits in a deleted one are lost, except what the script sets (packages, en-US "What's new", rollout, publish option).
- Description, keywords and screenshots are not touched; update them by hand if needed.

If it fails, use the manual steps below.

### Running locally

```bash
node script/storeRelease.ts mas x.y.z            # dry run: shows the current state and what it would change
node script/storeRelease.ts mas x.y.z --prepare  # optional: apply the changes without submitting, to check them in App Store Connect
node script/storeRelease.ts mas x.y.z --submit   # apply and submit for review
node script/storeRelease.ts msstore x.y.z        # dry run
node script/storeRelease.ts msstore x.y.z --submit
node script/storeRelease.ts msstore-rollout 20 --submit  # or "next"
```

with the credentials below as environment variables (never commit them).

### Credentials

GitHub repository secrets, used by the workflow:

- **Mac App Store**: `api_key` (the `.p8` file's contents), `api_key_id`, `api_key_issuer_id`, also used by the build workflow. Locally: `ASC_KEY_ID`, `ASC_ISSUER_ID` and the key in `~/.appstoreconnect/private_keys/AuthKey_<ASC_KEY_ID>.p8` (or `ASC_KEY_PATH`). The key needs the **App Manager** (or Admin) role. Create one in [App Store Connect → Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api) → Team Keys; the Issuer ID is shown at the top of that page.
- **Microsoft Store**: `MSSTORE_TENANT_ID`, `MSSTORE_CLIENT_ID`, `MSSTORE_CLIENT_SECRET` (same names locally). One-time setup:
  1. Partner Center → ⚙ Account settings → **Tenants**: associate a Microsoft Entra ID tenant, or create a new one there ([docs](https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/associate-azure-ad-with-partner-center)). You need to be Global administrator of the tenant.
  2. Account settings → **User management** (signed in with the tenant's account) → **Microsoft Entra applications** tab → **Add Microsoft Entra application** → **Create Microsoft Entra application**. Any name (e.g. `losslesscut-store-release`) and any unique Reply URL (e.g. `https://example.com/store-release`, it's not used). Role: **Manager**. Click **Create**.
  3. The Client ID is shown in the list of applications, and the Tenant ID under Account settings → Tenants.
  4. Click the application → **Add new key** and copy the **Key** (the client secret, shown only once). The page shows when the key expires; add a new one before that, and update the `MSSTORE_CLIENT_SECRET` secret.

### Microsoft Store (manual)

1. Download `LosslessCut-win-x64-DONT-USE-THIS-FILE.appx` and `LosslessCut-win-arm64-DONT-USE-THIS-FILE.appx` from the GitHub release, and remove `-DONT-USE-THIS-FILE` from the file names
2. Open the [Partner Center](https://partner.microsoft.com/en-us/dashboard/products/9P30LSR4705L/overview) and click "Start update"
3. "Packages": click the caret next to "Unchanged", then drag-drop both renamed files into the upload area. Both architectures go in the same submission and the Store serves the right one to each device (if a submission ever used an `.appxbundle`, later ones must too, see [#2789](https://github.com/mifi/lossless-cut/issues/2789))
4. Tick "Roll out update gradually", start rollout with 0%, wait for the uploads to finish and click "Save"
5. "Submission Options" (caret): tick "Don't publish this submission until I select Publish now"
6. "Store listings" → "Languages supported in packages" → "English (United States)": replace "What's new in this version" (see [Store release notes](#store-release-notes)). If needed, also update "Description", "Product features" and screenshots
7. Go back and click "Submit for certification"
8. Once certified, publish it, and increase the rollout by ~15% every day or so

### Mac App Store (manual)

Tag builds already upload the build to App Store Connect (`(MacOS) Upload to Mac App Store` in `build.yml`).

1. In [App Store Connect](https://appstoreconnect.apple.com/apps/1505323402/distribution), create a new version, numbered after the previous App Store version (e.g. 1.14 → 1.15), not the GitHub version
2. "Build": click "Add Build" and pick the build of this version
3. Update "What's New in This Version" (see [Store release notes](#store-release-notes)). If needed, also update "Description" and screenshots
4. "App Store Version Release": tick "Manually release this version"
5. "Phased Release for App Store Automatic Updates": tick "Release update over 7-day period using phased release"
6. Save, then "Add for Review"
7. Once approved, release it

## After releasing existing GitHub version in Stores

Move the store's branch to the tag of the version that was just released there:

```bash
git push origin vX.Y.Z^{commit}:apple-store  # Mac App Store
git push origin vX.Y.Z^{commit}:ms-store     # Microsoft Store
```

This fails if the branch has a hotfix that isn't in the tag. Merge the branch into `master` first, see [After releasing in GitHub](#after-releasing-in-github).

## Store release notes

*Written for agents, who draft the text for the user to review.*

The stores lag behind GitHub releases, so their "What's new" text must cover every version since the one currently live in that store. Before drafting, check what's in each store, because the store branches can lag behind: a version can be approved and waiting to be released (Mac App Store: "Pending Developer Release"), or certified and waiting for "Publish now" (Microsoft Store: a pending submission). The script's dry run shows this (`Latest App Store versions`, `Pending submission`). The `apple-store` and `ms-store` branches point to the live version (`git describe --tags origin/apple-store`); if unsure whether they're up to date, ask the user (Mac App Store: App Store Connect; Microsoft Store: Partner Center → the product's current submission → Packages), then combine `versions/*.md` after it up to the version being released. Mac App Store versions have their own numbering (1.x); the GitHub version is that of the build attached to it.

- Write for customers: lead with the most impactful new features and visible fixes. Leave out internals (dependency/FFmpeg upgrades, security fixes, refactors) and niche power-user details; they're covered by a final "Many other improvements and fixes". The longer since the last store release, the more of the interesting changes can be included.
- Plain text, no Markdown, code formatting, issue references or links. Use plain-language feature names instead of internal action/variable names.
- Leave out what doesn't apply to that store's build: items for other platforms (App Review rejects mentions of other platforms), GitHub-only builds, custom FFmpeg path (not in the Mac App Store build), update checks.
- Microsoft Store: max 1500 characters. Mac App Store: max 4000 characters.
- Write them to `store-release-notes/mas-<version>.txt` and `store-release-notes/msstore-<version>.txt`, where `script/storeRelease.ts` reads them, and ask the user to review them before committing. Only run the script with `--prepare` or `--submit` (or the Store release workflow with "submit") after the user approves the text and the dry-run output.

## Release announcement

*Written for agents, who draft and post with the user.*

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

## More info

For per-platform build/signing setup, see [this article](https://mifi.no/blog/automated-electron-build-with-release-to-mac-app-store-microsoft-store-snapcraft/).

## Yearly Apple certificate renewal

Apple sends an email when certificates are about to expire. Follow the "Certificate creation/renewal" section of [the article above](https://mifi.no/blog/automated-electron-build-with-release-to-mac-app-store-microsoft-store-snapcraft/). LosslessCut specifics:

- The Development provisioning profile is kept in the project root as `LosslessCut_Dev.provisionprofile` (gitignored) — replace it with the newly downloaded one, for use with `yarn pack-mas-dev`.
