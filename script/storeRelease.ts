// Prepares (and with --submit, submits for review) a store release. See RELEASING.md → "Release in Stores".
// Without --prepare or --submit, it only reads and prints what it would change.
//
// node script/storeRelease.ts mas <version> [--notes file] [--prepare | --submit]
// node script/storeRelease.ts msstore <version> [--notes file] [--submit]
// node script/storeRelease.ts msstore-rollout <percent|next> [--submit]
//
// Credentials come from the environment:
// Mac App Store: ASC_KEY_ID, ASC_ISSUER_ID, and ASC_KEY (the .p8 key's contents) or ASC_KEY_PATH (default ~/.appstoreconnect/private_keys/AuthKey_<ASC_KEY_ID>.p8)
// Microsoft Store: MSSTORE_TENANT_ID, MSSTORE_CLIENT_ID, MSSTORE_CLIENT_SECRET
import assert from 'node:assert';
import { createPrivateKey, sign } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, openAsBlob } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { execa } from 'execa';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { appLinkTargets, websiteUrl } from '../src/common/websiteUrls.ts';


const masAppId = '1505323402';
const msStoreAppId = '9P30LSR4705L';
const githubRepo = 'mifi/lossless-cut';
const msStoreArchs = ['x64', 'arm64'];
// Same steps as Apple's 7-day phased release
const msStoreRolloutSteps = [1, 2, 5, 10, 20, 50, 100];
// Mac App Store only: the Microsoft Store's privacy policy URL can only be changed in Partner Center (Properties), its API ignores it.
// The page itself rather than its /go/ link, for the reviewers.
const privacyPolicyUrl = `${websiteUrl}${appLinkTargets['privacy-policy']}`;

const args = yargs(hideBin(process.argv))
  .command('mas <version>', 'Mac App Store')
  .command('msstore <version>', 'Microsoft Store')
  .command('msstore-rollout <percent>', `Change the Microsoft Store gradual rollout percentage of the last published submission (100 finalizes it). "next" goes to the next of ${msStoreRolloutSteps.join(', ')}%, and does nothing if no rollout is in progress`)
  .demandCommand(1)
  .version(false)
  .string(['version', 'percent'])
  .option('notes', { type: 'string', describe: 'What\'s New text file (default: store-release-notes/<store>-<version>.txt)' })
  .option('prepare', { type: 'boolean', default: false, describe: 'Mac App Store: write the changes, but don\'t submit for review' })
  .option('submit', { type: 'boolean', default: false, describe: 'Write the changes and submit for review' })
  .strict()
  .parseSync();

const [store] = args._.map(String);
const write = args.submit || args.prepare;
assert(!args.prepare || store === 'mas', '--prepare is only supported for mas');

function requireEnv(name: string) {
  const value = process.env[name];
  assert(value, `Missing environment variable ${name}`);
  return value;
}

const log = (...rest: unknown[]) => console.log(...rest);
const plan = (msg: string) => log(write ? `→ ${msg}` : `[dry run] would: ${msg}`);
// stops a real run, but lets a dry run go on to show the rest of its plan
const blocker = (msg: string) => {
  assert(!write, msg);
  log(`[dry run] BLOCKED, --submit would stop here: ${msg}`);
};

async function fetchJson(url: string, init: RequestInit & { hint?: string } = {}) {
  const { hint, ...rest } = init;
  const response = await fetch(url, rest);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${rest.method ?? 'GET'} ${url.split('?')[0]}: HTTP ${response.status}\n${text}${hint && response.status === 403 ? `\n${hint}` : ''}`);
  }
  return text ? JSON.parse(text) : undefined;
}

async function readNotes(version: string, maxLength: number) {
  const path = args.notes ?? `store-release-notes/${store}-${version}.txt`;
  if (!write && !existsSync(path)) {
    log(`What's New: ${path} doesn't exist yet\n`);
    return '';
  }
  const notes = (await readFile(path, 'utf8')).trim();
  assert(notes.length > 0, `${path} is empty`);
  assert(notes.length <= maxLength, `${path} is ${notes.length} characters, the max is ${maxLength}`);
  log(`What's New (${path}, ${notes.length}/${maxLength} characters):\n\n${notes}\n`);
  return notes;
}


// App Store Connect API https://developer.apple.com/documentation/appstoreconnectapi

const ascBase = 'https://api.appstoreconnect.apple.com';
const ascRoleHint = 'The API key needs the "App Manager" (or "Admin") role. Create one in App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys.';

interface AscResource { id: string, type: string, attributes: Record<string, unknown>, relationships?: Record<string, { data?: { id: string } | null }> }

let ascKey: ReturnType<typeof createPrivateKey> | undefined;

async function ascToken() {
  const keyId = requireEnv('ASC_KEY_ID');
  ascKey ??= createPrivateKey(process.env['ASC_KEY'] ?? await readFile(process.env['ASC_KEY_PATH'] ?? join(homedir(), '.appstoreconnect/private_keys', `AuthKey_${keyId}.p8`)));
  const base64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url({ alg: 'ES256', kid: keyId, typ: 'JWT' })}.${base64url({ iss: requireEnv('ASC_ISSUER_ID'), iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' })}`;
  return `${unsigned}.${sign('sha256', Buffer.from(unsigned), { key: ascKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

async function asc<T = AscResource>(method: string, path: string, data?: object) {
  const response = await fetchJson(`${ascBase}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await ascToken()}`, ...(data && { 'Content-Type': 'application/json' }) },
    ...(data && { body: JSON.stringify({ data }) }),
    hint: ascRoleHint,
  });
  return response?.data as T | null | undefined;
}

const ref = (type: string, id: string) => ({ data: { type, id } });

async function findMasBuild(version: string) {
  const builds = await asc<AscResource[]>('GET', `/v1/builds?filter[app]=${masAppId}&filter[preReleaseVersion.version]=${version}&filter[preReleaseVersion.platform]=MAC_OS&sort=-uploadedDate&limit=1`);
  return builds?.[0];
}

// The privacy policy URL is in the app info (per app, not per version), which can only be changed while a version is being prepared (or was rejected)
async function masPrivacyPolicy() {
  const appInfos = (await asc<AscResource[]>('GET', `/v1/apps/${masAppId}/appInfos?limit=200`))!;
  const editable = appInfos.find((i) => ['PREPARE_FOR_SUBMISSION', 'READY_FOR_REVIEW', 'DEVELOPER_REJECTED', 'REJECTED'].includes(String(i.attributes['state'])));
  if (!editable) {
    log(`Warning: no editable app info (states: ${appInfos.map((i) => i.attributes['state']).join(', ')}), so the privacy policy URL can't be checked. Check it in App Store Connect → App Information (should be ${privacyPolicyUrl})`);
    return;
  }
  const localizations = (await asc<AscResource[]>('GET', `/v1/appInfos/${editable.id}/appInfoLocalizations?limit=200`))!;
  for (const localization of localizations) {
    const { locale, privacyPolicyUrl: current } = localization.attributes;
    if (current === privacyPolicyUrl) {
      log(`${locale} privacy policy URL is already up to date`);
    } else {
      plan(`set the ${locale} privacy policy URL to ${privacyPolicyUrl} (currently: ${JSON.stringify(current ?? null)})`);
      // eslint-disable-next-line no-await-in-loop
      if (write) await asc('PATCH', `/v1/appInfoLocalizations/${localization.id}`, { type: 'appInfoLocalizations', id: localization.id, attributes: { privacyPolicyUrl } });
    }
  }
}

async function mas(version: string) {
  const notes = await readNotes(version, 4000);

  const app = await asc('GET', `/v1/apps/${masAppId}`);
  log(`App: ${app?.attributes['name']} (${app?.attributes['bundleId']})`);

  // App Store versions have their own numbering (1.x), independent of the build (package.json) version
  const versions = (await asc<AscResource[]>('GET', `/v1/apps/${masAppId}/appStoreVersions?filter[platform]=MAC_OS&limit=200`))!
    .toSorted((a, b) => String(b.attributes['createdDate']).localeCompare(String(a.attributes['createdDate'])));
  log('Latest App Store versions:');
  for (const v of versions.slice(0, 3)) log(`  ${v.attributes['versionString']}: ${v.attributes['appVersionState']}`);

  let build = await findMasBuild(version);
  log(`Build ${version}: ${build ? `${build.attributes['processingState']}, uploaded ${build.attributes['uploadedDate']}` : 'not uploaded yet'}`);

  // Only one version can be editable at a time, so reuse it. READY_FOR_REVIEW: added to a review submission that wasn't submitted
  const isEditable = (v: AscResource) => ['PREPARE_FOR_SUBMISSION', 'READY_FOR_REVIEW', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY'].includes(String(v.attributes['appVersionState']));
  const editable = versions.find((v) => isEditable(v));
  const attachedTo = build && await asc('GET', `/v1/builds/${build.id}/appStoreVersion`);
  if (attachedTo && !isEditable(attachedTo)) {
    log(`Build ${version} is already in App Store version ${attachedTo.attributes['versionString']} (${attachedTo.attributes['appVersionState']}), nothing to do`);
    return;
  }
  const inFlight = versions.find((v) => ['WAITING_FOR_REVIEW', 'WAITING_FOR_EXPORT_COMPLIANCE', 'IN_REVIEW', 'ACCEPTED', 'PENDING_DEVELOPER_RELEASE', 'PENDING_APPLE_RELEASE', 'PROCESSING_FOR_DISTRIBUTION'].includes(String(v.attributes['appVersionState'])));
  assert(editable || !inFlight, `App Store version ${inFlight?.attributes['versionString']} is ${inFlight?.attributes['appVersionState']}; release it (or remove it from review) before creating a new version`);
  const [major, minor] = String(versions[0]!.attributes['versionString']).split('.').map(Number);
  const versionString = editable ? String(editable.attributes['versionString']) : `${major}.${minor! + 1}`;

  if (write) {
    for (let i = 0; build?.attributes['processingState'] !== 'VALID'; i += 1) {
      assert(build == null || build.attributes['processingState'] === 'PROCESSING', `Build ${version} is ${build?.attributes['processingState']}`);
      assert(i < 60, `Build ${version} didn't finish processing in time`);
      log('Waiting for the build to be uploaded/processed…');
      // eslint-disable-next-line no-await-in-loop
      await sleep(60_000);
      // eslint-disable-next-line no-await-in-loop
      build = await findMasBuild(version);
    }
  }

  let versionId: string;
  const attributes = { versionString, releaseType: 'MANUAL' };
  if (editable) {
    plan(`update the editable App Store version ${versionString}: manual release, build ${version}`);
    if (write) {
      await asc('PATCH', `/v1/appStoreVersions/${editable.id}`, { type: 'appStoreVersions', id: editable.id, attributes, relationships: { build: ref('builds', build!.id) } });
    }
    versionId = editable.id;
  } else {
    plan(`create App Store version ${versionString}: manual release, build ${version}`);
    if (!write) {
      plan(`set en-US What's New, set the privacy policy URL to ${privacyPolicyUrl} if needed, enable 7-day phased release, submit for review`);
      return;
    }
    const created = await asc('POST', '/v1/appStoreVersions', {
      type: 'appStoreVersions',
      attributes: { platform: 'MAC_OS', ...attributes },
      relationships: { app: ref('apps', masAppId), build: ref('builds', build!.id) },
    });
    versionId = created!.id;
  }

  const localizations = (await asc<AscResource[]>('GET', `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`))!;
  const enUs = localizations.find((l) => l.attributes['locale'] === 'en-US');
  assert(enUs, 'No en-US localization');
  const otherLocales = localizations.filter((l) => l !== enUs).map((l) => l.attributes['locale']);
  if (otherLocales.length > 0) log(`Note: only en-US What's New is set, other locales: ${otherLocales.join(', ')}`);
  if (enUs.attributes['whatsNew'] === notes) {
    log('en-US What\'s New is already up to date');
  } else {
    plan(`set en-US What's New (currently: ${JSON.stringify(enUs.attributes['whatsNew'] ?? null).slice(0, 100)}…)`);
    if (write) await asc('PATCH', `/v1/appStoreVersionLocalizations/${enUs.id}`, { type: 'appStoreVersionLocalizations', id: enUs.id, attributes: { whatsNew: notes } });
  }

  await masPrivacyPolicy();

  const phasedRelease = await asc('GET', `/v1/appStoreVersions/${versionId}/appStoreVersionPhasedRelease`);
  if (phasedRelease) {
    log(`Phased release: ${phasedRelease.attributes['phasedReleaseState']}`);
  } else {
    plan('enable 7-day phased release');
    if (write) await asc('POST', '/v1/appStoreVersionPhasedReleases', { type: 'appStoreVersionPhasedReleases', attributes: { phasedReleaseState: 'INACTIVE' }, relationships: { appStoreVersion: ref('appStoreVersions', versionId) } });
  }

  if (!args.submit) {
    if (!write) plan('submit for review');
    return;
  }
  // Reuse an unsubmitted or rejected submission (left by an earlier run or App Review), only one can be open
  const [openSubmission] = (await asc<AscResource[]>('GET', `/v1/reviewSubmissions?filter[app]=${masAppId}&filter[platform]=MAC_OS&filter[state]=READY_FOR_REVIEW,UNRESOLVED_ISSUES`))!;
  const submission = openSubmission ?? (await asc('POST', '/v1/reviewSubmissions', { type: 'reviewSubmissions', attributes: { platform: 'MAC_OS' }, relationships: { app: ref('apps', masAppId) } }))!;
  const items = openSubmission ? (await asc<AscResource[]>('GET', `/v1/reviewSubmissions/${submission.id}/items?include=appStoreVersion`))! : [];
  const item = items.find((i) => i.relationships?.['appStoreVersion']?.data?.id === versionId);
  if (!item) {
    await asc('POST', '/v1/reviewSubmissionItems', { type: 'reviewSubmissionItems', relationships: { reviewSubmission: ref('reviewSubmissions', submission.id), appStoreVersion: ref('appStoreVersions', versionId) } });
  } else if (item.attributes['state'] === 'REJECTED') {
    await asc('PATCH', `/v1/reviewSubmissionItems/${item.id}`, { type: 'reviewSubmissionItems', id: item.id, attributes: { resolved: true } });
  }
  const submitted = await asc('PATCH', `/v1/reviewSubmissions/${submission.id}`, { type: 'reviewSubmissions', id: submission.id, attributes: { submitted: true } });
  log(`Submitted for review: ${submitted?.attributes['state']}`);
}


// Microsoft Store submission API https://learn.microsoft.com/en-us/windows/uwp/monetize/create-and-manage-submissions-using-windows-store-services

const msBase = `https://manage.devcenter.microsoft.com/v1.0/my/applications/${msStoreAppId}`;
const msRoleHint = 'The Entra ID application needs the "Manager" role in Partner Center → Account settings → User management → Microsoft Entra applications.';

let msTokenCache: { token: string, expires: number } | undefined;

async function msToken() {
  if (!msTokenCache || Date.now() > msTokenCache.expires) {
    const response = await fetchJson(`https://login.microsoftonline.com/${requireEnv('MSSTORE_TENANT_ID')}/oauth2/token`, {
      method: 'POST',
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: requireEnv('MSSTORE_CLIENT_ID'), client_secret: requireEnv('MSSTORE_CLIENT_SECRET'), resource: 'https://manage.devcenter.microsoft.com' }),
    });
    // valid for 60 minutes, renew a bit before
    msTokenCache = { token: response.access_token, expires: Date.now() + (Number(response.expires_in) - 300) * 1000 };
  }
  return msTokenCache.token;
}

async function ms(method: string, path: string, body?: object) {
  return fetchJson(`${msBase}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await msToken()}`, ...(body && { 'Content-Type': 'application/json' }) },
    ...(body && { body: JSON.stringify(body) }),
    hint: msRoleHint,
  });
}

interface MsPackage { fileName: string, fileStatus: string, version?: string, architecture?: string, minimumDirectXVersion?: string, minimumSystemRam?: string }

function logMsSubmission(label: string, submission: { id: string, friendlyName: string, status: string, applicationPackages: MsPackage[] }, extra = '') {
  log(`${label} submission ${submission.id} (${submission.friendlyName}): ${submission.status}${extra}`);
  for (const p of submission.applicationPackages) log(`  ${p.fileName} ${p.version} ${p.architecture}`);
}

async function getMsApp() {
  const app = await ms('GET', '');
  log(`App: ${app.primaryName} (${app.id})`);
  assert(app.lastPublishedApplicationSubmission, 'No published submission');
  const published = await ms('GET', `/submissions/${app.lastPublishedApplicationSubmission.id}`);
  const { packageRollout } = published.packageDeliveryOptions;
  logMsSubmission('Last published', published, `, rollout ${packageRollout.isPackageRollout ? `${packageRollout.packageRolloutPercentage}% ${packageRollout.packageRolloutStatus}` : 'off'}`);
  return { app, published };
}

async function msstore(version: string) {
  const notes = await readNotes(version, 1500);
  const { app, published } = await getMsApp();
  const hasVersion = (submission: { applicationPackages: MsPackage[] }) => submission.applicationPackages.some((p) => p.version === `${version}.0`);
  if (hasVersion(published)) {
    log(`${version} is already published, nothing to do`);
    return;
  }
  if (app.pendingApplicationSubmission) {
    const pending = await ms('GET', `/submissions/${app.pendingApplicationSubmission.id}`);
    logMsSubmission('Pending', pending);
    if (hasVersion(pending)) {
      log(`${version} is already submitted, nothing to do. Once certified, click "Publish now" in Partner Center`);
      return;
    }
    blocker(pending.status === 'PendingCommit'
      ? 'The pending submission was never submitted (maybe left by a failed run). Delete it in Partner Center and run again'
      : 'Finish or delete the pending submission in Partner Center first');
  }
  if (published.packageDeliveryOptions.packageRollout.packageRolloutStatus === 'PackageRolloutInProgress') {
    blocker('The last published submission\'s gradual rollout is still in progress; finalize it first (msstore-rollout 100) or halt it in Partner Center');
  }

  const packages = msStoreArchs.map((arch) => ({
    url: `https://github.com/${githubRepo}/releases/download/v${version}/LosslessCut-win-${arch}-DONT-USE-THIS-FILE.appx`,
    fileName: `LosslessCut-win-${arch}.appx`,
  }));
  for (const { url } of packages) {
    // eslint-disable-next-line no-await-in-loop
    const response = await fetch(url, { method: 'HEAD' });
    assert(response.ok, `${url}: HTTP ${response.status}`);
    log(`${url} (${(Number(response.headers.get('content-length')) / 1e6).toFixed(0)} MB)`);
  }

  plan(`create a submission (a copy of ${published.id}), replace the packages with ${packages.map((p) => p.fileName).join(', ')}, roll out gradually starting at 0%, don't publish until "Publish now", set en-US What's new (currently: ${JSON.stringify(published.listings['en-us']?.baseListing.releaseNotes ?? null).slice(0, 100)}…)`);
  plan('submit for certification');
  if (!args.submit) return;

  const dir = await mkdtemp(join(tmpdir(), 'losslesscut-msstore-'));
  try {
    for (const { url, fileName } of packages) {
      log(`Downloading ${fileName}…`);
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(url);
      assert(response.ok, `${url}: HTTP ${response.status}`);
      // eslint-disable-next-line no-await-in-loop
      await writeFile(join(dir, fileName), Buffer.from(await response.arrayBuffer()));
    }
    const zipPath = join(dir, 'upload.zip');
    // appx is already compressed
    await execa('zip', ['-0', '-j', zipPath, ...packages.map((p) => join(dir, p.fileName))]);

    const submission = await ms('POST', '/submissions');
    log(`Created submission ${submission.id}`);
    assert(submission.listings['en-us'], `No en-us listing, found: ${Object.keys(submission.listings).join(', ')}`);
    submission.listings['en-us'].baseListing.releaseNotes = notes;
    submission.applicationPackages = [
      // like Partner Center does when uploading new packages for the same architectures
      ...(submission.applicationPackages as MsPackage[]).map((p) => ({ ...p, fileStatus: 'PendingDelete' })),
      ...packages.map(({ fileName }) => ({ fileName, fileStatus: 'PendingUpload', minimumDirectXVersion: 'None', minimumSystemRam: 'None' })),
    ];
    submission.packageDeliveryOptions.packageRollout = { isPackageRollout: true, packageRolloutPercentage: 0 };
    submission.targetPublishMode = 'Manual';
    await ms('PUT', `/submissions/${submission.id}`, submission);

    log('Uploading packages…');
    const upload = await fetch(submission.fileUploadUrl, {
      method: 'PUT',
      // 2019-12-12 and newer allow single uploads up to 5000 MiB (the packages are ~500 MB)
      headers: { 'x-ms-blob-type': 'BlockBlob', 'x-ms-version': '2021-12-02' },
      body: await openAsBlob(zipPath),
    });
    assert(upload.ok, `Upload failed: HTTP ${upload.status} ${await upload.text()}`);

    await ms('POST', `/submissions/${submission.id}/commit`);
    let status: { status: string, statusDetails: unknown };
    for (let i = 0; ; i += 1) {
      assert(i < 60, 'Commit didn\'t finish in time, check the submission in Partner Center');
      // eslint-disable-next-line no-await-in-loop
      await sleep(10_000);
      // eslint-disable-next-line no-await-in-loop
      status = await ms('GET', `/submissions/${submission.id}/status`);
      log(status.status);
      if (!['PendingCommit', 'CommitStarted'].includes(status.status)) break;
    }
    assert(status.status !== 'CommitFailed', `Commit failed: ${JSON.stringify(status.statusDetails, null, 2)}`);
    log(`Submitted for certification: https://partner.microsoft.com/en-us/dashboard/products/${msStoreAppId}/submissions/${submission.id}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function msstoreRollout(percentArg: string) {
  const { published } = await getMsApp();
  const { packageRolloutStatus, packageRolloutPercentage } = published.packageDeliveryOptions.packageRollout;
  if (packageRolloutStatus !== 'PackageRolloutInProgress') {
    assert(percentArg === 'next', 'The last published submission has no gradual rollout in progress (did you click "Publish now"?)');
    log('No rollout in progress, nothing to do');
    return;
  }
  const percent = percentArg === 'next' ? (msStoreRolloutSteps.find((step) => step > packageRolloutPercentage) ?? 100) : Number(percentArg);
  assert(percent > 0 && percent <= 100, 'Percent must be in (0, 100]');
  const action = percent === 100 ? 'finalizepackagerollout' : `updatepackagerolloutpercentage?percentage=${percent}`;
  plan(percent === 100 ? 'finalize the rollout (100%)' : `set rollout to ${percent}%`);
  if (!args.submit) return;
  log(await ms('POST', `/submissions/${published.id}/${action}`));
}


const version = String(args['version']);
assert(store === 'msstore-rollout' || /^\d+\.\d+\.\d+$/.test(version), `Invalid version ${version}`);
switch (store) {
  case 'mas': { await mas(version); break; }
  case 'msstore': { await msstore(version); break; }
  case 'msstore-rollout': { await msstoreRollout(String(args['percent'])); break; }
  default: { throw new Error(`Unknown command ${store}`); }
}
if (!write) log('\nDry run, nothing was changed. Use --submit to apply.');
