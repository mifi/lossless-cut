// Prepares (and with --submit, submits for review) a store release. See CONTRIBUTING.md → "Release in Stores".
// Without --prepare or --submit, it only reads and prints what it would change.
//
// node script/storeRelease.ts mas <version> [--notes file] [--prepare | --submit]
// node script/storeRelease.ts msstore <version> [--notes file] [--submit]
// node script/storeRelease.ts msstore-rollout <percent> [--submit]
//
// Credentials come from the environment:
// Mac App Store: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (default ~/.appstoreconnect/private_keys/AuthKey_<ASC_KEY_ID>.p8)
// Microsoft Store: MSSTORE_TENANT_ID, MSSTORE_CLIENT_ID, MSSTORE_CLIENT_SECRET
import assert from 'node:assert';
import { createPrivateKey, sign } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { openAsBlob } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { execa } from 'execa';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';


const masAppId = '1505323402';
const msStoreAppId = '9P30LSR4705L';
const githubRepo = 'mifi/lossless-cut';
const msStoreArchs = ['x64', 'arm64'];

const args = yargs(hideBin(process.argv))
  .command('mas <version>', 'Mac App Store')
  .command('msstore <version>', 'Microsoft Store')
  .command('msstore-rollout <percent>', 'Change the Microsoft Store gradual rollout percentage of the last published submission (100 finalizes it)')
  .demandCommand(1)
  .version(false)
  .option('notes', { type: 'string', describe: 'What\'s New text file (default: notes/<store>-whats-new-<version>.txt)' })
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
  const path = args.notes ?? `notes/${store}-whats-new-${version}.txt`;
  const notes = (await readFile(path, 'utf8')).trim();
  assert(notes.length > 0, `${path} is empty`);
  assert(notes.length <= maxLength, `${path} is ${notes.length} characters, the max is ${maxLength}`);
  log(`What's New (${path}, ${notes.length}/${maxLength} characters):\n\n${notes}\n`);
  return notes;
}


// App Store Connect API https://developer.apple.com/documentation/appstoreconnectapi

const ascBase = 'https://api.appstoreconnect.apple.com';
const ascRoleHint = 'The API key needs the "App Manager" (or "Admin") role. Create one in App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys.';

interface AscResource { id: string, type: string, attributes: Record<string, unknown> }

let ascKey: ReturnType<typeof createPrivateKey> | undefined;

async function ascToken() {
  const keyId = requireEnv('ASC_KEY_ID');
  ascKey ??= createPrivateKey(await readFile(process.env['ASC_KEY_PATH'] ?? join(homedir(), '.appstoreconnect/private_keys', `AuthKey_${keyId}.p8`)));
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

async function mas(version: string) {
  assert(/^\d+\.\d+\.\d+$/.test(version), `Invalid version ${version}`);
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

  // Only one version can be editable at a time, so reuse it
  const isEditable = (v: AscResource) => ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY'].includes(String(v.attributes['appVersionState']));
  const editable = versions.find((v) => isEditable(v));
  const attachedTo = build && await asc('GET', `/v1/builds/${build.id}/appStoreVersion`);
  if (attachedTo && !isEditable(attachedTo)) {
    log(`Build ${version} is already in App Store version ${attachedTo.attributes['versionString']} (${attachedTo.attributes['appVersionState']}), nothing to do`);
    return;
  }
  const inFlight = versions.find((v) => ['WAITING_FOR_REVIEW', 'IN_REVIEW', 'READY_FOR_REVIEW', 'ACCEPTED', 'PENDING_DEVELOPER_RELEASE', 'PENDING_APPLE_RELEASE', 'PROCESSING_FOR_DISTRIBUTION'].includes(String(v.attributes['appVersionState'])));
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
      plan('set en-US What\'s New, enable 7-day phased release, submit for review');
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
  const openSubmissions = await asc<AscResource[]>('GET', `/v1/reviewSubmissions?filter[app]=${masAppId}&filter[platform]=MAC_OS&filter[state]=READY_FOR_REVIEW`);
  const submission = openSubmissions?.[0] ?? await asc('POST', '/v1/reviewSubmissions', { type: 'reviewSubmissions', attributes: { platform: 'MAC_OS' }, relationships: { app: ref('apps', masAppId) } });
  await asc('POST', '/v1/reviewSubmissionItems', { type: 'reviewSubmissionItems', relationships: { reviewSubmission: ref('reviewSubmissions', submission!.id), appStoreVersion: ref('appStoreVersions', versionId) } });
  const submitted = await asc('PATCH', `/v1/reviewSubmissions/${submission!.id}`, { type: 'reviewSubmissions', id: submission!.id, attributes: { submitted: true } });
  log(`Submitted for review: ${submitted?.attributes['state']}`);
}


// Microsoft Store submission API https://learn.microsoft.com/en-us/windows/uwp/monetize/create-and-manage-submissions-using-windows-store-services

const msBase = `https://manage.devcenter.microsoft.com/v1.0/my/applications/${msStoreAppId}`;
const msRoleHint = 'The Entra ID application needs the "Manager" role in Partner Center → Account settings → User management → Microsoft Entra applications.';

let msTokenPromise: Promise<string> | undefined;

async function msToken() {
  msTokenPromise ??= (async () => {
    const response = await fetchJson(`https://login.microsoftonline.com/${requireEnv('MSSTORE_TENANT_ID')}/oauth2/token`, {
      method: 'POST',
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: requireEnv('MSSTORE_CLIENT_ID'), client_secret: requireEnv('MSSTORE_CLIENT_SECRET'), resource: 'https://manage.devcenter.microsoft.com' }),
    });
    return response.access_token as string;
  })();
  return msTokenPromise; // valid for 60 minutes
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

async function getMsApp() {
  const app = await ms('GET', '');
  log(`App: ${app.primaryName} (${app.id})`);
  assert(app.lastPublishedApplicationSubmission, 'No published submission');
  const published = await ms('GET', `/submissions/${app.lastPublishedApplicationSubmission.id}`);
  const { packageRollout } = published.packageDeliveryOptions;
  log(`Last published submission ${published.id} (${published.friendlyName}): ${published.status}, rollout ${packageRollout.isPackageRollout ? `${packageRollout.packageRolloutPercentage}% ${packageRollout.packageRolloutStatus}` : 'off'}`);
  for (const p of published.applicationPackages as MsPackage[]) log(`  ${p.fileName} ${p.version} ${p.architecture}`);
  return { app, published };
}

async function msstore(version: string) {
  assert(/^\d+\.\d+\.\d+$/.test(version), `Invalid version ${version}`);
  const notes = await readNotes(version, 1500);
  const { app, published } = await getMsApp();
  assert(!app.pendingApplicationSubmission, `There is already a pending submission (${app.pendingApplicationSubmission?.id}). Finish or delete it in Partner Center first`);
  if (published.packageDeliveryOptions.packageRollout.packageRolloutStatus === 'PackageRolloutInProgress') {
    log('Warning: the last published submission\'s rollout is still in progress; Partner Center may require finalizing or halting it first (msstore-rollout 100)');
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

  plan(`create a submission (a copy of ${published.id}), add packages ${packages.map((p) => p.fileName).join(', ')} (keeping the existing ones), roll out gradually starting at 0%, don't publish until "Publish now", set en-US What's new (currently: ${JSON.stringify(published.listings['en-us']?.baseListing.releaseNotes ?? null).slice(0, 100)}…)`);
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
      ...submission.applicationPackages,
      ...packages.map(({ fileName }) => ({ fileName, fileStatus: 'PendingUpload', minimumDirectXVersion: 'None', minimumSystemRam: 'None' })),
    ];
    submission.packageDeliveryOptions.packageRollout = { isPackageRollout: true, packageRolloutPercentage: 0 };
    submission.targetPublishMode = 'Manual';
    await ms('PUT', `/submissions/${submission.id}`, submission);

    log('Uploading packages…');
    const upload = await fetch(submission.fileUploadUrl, { method: 'PUT', headers: { 'x-ms-blob-type': 'BlockBlob' }, body: await openAsBlob(zipPath) });
    assert(upload.ok, `Upload failed: HTTP ${upload.status} ${await upload.text()}`);

    await ms('POST', `/submissions/${submission.id}/commit`);
    let status: { status: string, statusDetails: unknown };
    do {
      // eslint-disable-next-line no-await-in-loop
      await sleep(10_000);
      // eslint-disable-next-line no-await-in-loop
      status = await ms('GET', `/submissions/${submission.id}/status`);
      log(status.status);
    } while (status.status === 'CommitStarted');
    assert(status.status !== 'CommitFailed', `Commit failed: ${JSON.stringify(status.statusDetails, null, 2)}`);
    log(`Submitted for certification: https://partner.microsoft.com/en-us/dashboard/products/${msStoreAppId}/submissions/${submission.id}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function msstoreRollout(percent: number) {
  assert(percent > 0 && percent <= 100, 'Percent must be in (0, 100]');
  const { published } = await getMsApp();
  const action = percent === 100 ? 'finalizepackagerollout' : `updatepackagerolloutpercentage?percentage=${percent}`;
  plan(percent === 100 ? 'finalize the rollout (100%)' : `set rollout to ${percent}%`);
  if (!args.submit) return;
  log(await ms('POST', `/submissions/${published.id}/${action}`));
}


switch (store) {
  case 'mas': { await mas(String(args['version'])); break; }
  case 'msstore': { await msstore(String(args['version'])); break; }
  case 'msstore-rollout': { await msstoreRollout(Number(args['percent'])); break; }
  default: { throw new Error(`Unknown command ${store}`); }
}
if (!write) log('\nDry run, nothing was changed. Use --submit to apply.');
