import execa from 'execa';
import { readFile } from 'fs/promises';

// we need a wrapper script because altool tends to error out very often
// https://developer.apple.com/forums/thread/698477
// and it errors if binary already exists, we want it to just silently fail in that case

const args = process.argv.slice(2);

const filePath = args[0];
const apiKeyId = args[1];
const apiIssuer = args[2];
const appleId = args[3];
const bundleId = args[4];

// seems to be the same
const ascPublicId = apiIssuer;

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));

console.log('Using version', packageJson.version);

const packageVersion = packageJson.version;
// const packageVersion = '3.39.2';

const bundleVersion = packageVersion;
const bundleShortVersionString = packageVersion;

/*
Example JSON response:
{
    "tool-version": "4.060.1220",
    "tool-path": "\\/Applications\\/Xcode.app\\/Contents\\/SharedFrameworks\\/ContentDeliveryServices.framework\\/Versions\\/A\\/Frameworks\\/AppStoreService.framework",
    "os-version": "11.6.0",
    "product-errors": [
        {
            "message": "Unable to upload archive.",
            "userInfo": {
                "NSLocalizedDescription": "Unable to upload archive.",
                "NSLocalizedFailureReason": "The file 'test' cannot be found."
            },
            "code": -43
        },
        {
            "message": "Unable to upload archive.",
            "userInfo": {
                "NSLocalizedDescription": "Unable to upload archive.",
                "NSLocalizedFailureReason": "--upload-app is missing one or more required options: --type."
            },
            "code": -1027
        }
    ]
}
*/

async function runAttempt() {
  // const xcrunArgs = ['altool', '--list-apps', '--output-format', 'json', '--apiKey', apiKeyId, '--apiIssuer', apiIssuer];

  const xcrunArgs = [
    'altool',
    '--output-format', 'json',
    '--upload-package', filePath, '--type', 'macos',
    '--apiKey', apiKeyId, '--apiIssuer', apiIssuer,
    '--asc-public-id', ascPublicId,
    '--apple-id', appleId,
    '--bundle-id', bundleId,
    '--bundle-version', bundleVersion,
    '--bundle-short-version-string', bundleShortVersionString,
  ];

  try {
    const { stdout } = await execa('xcrun', xcrunArgs);
    console.log('stdout', stdout);
    return false;
  } catch (err) {
    if (err.exitCode === 1 && err.stdout) {
      const errorJson = JSON.parse(err.stdout);
      const productErrors = errorJson['product-errors'];
      // Unable to authenticate
      if (productErrors.some((error) => error.code === -19209)) {
        console.log(productErrors);
        return true; // retry
      }
      // "The bundle version, x.y.z, must be a higher than the previously uploaded version."
      if (productErrors.some((error) => error.code === -19210)) {
        console.log(productErrors);
        // ignore
        return false;
      }
    }
    throw err;
  }
}

const maxRetries = 3;

async function run() {
  for (let i = 0; i < maxRetries; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const wantRetry = await runAttempt();
    if (!wantRetry) return; // success
    console.log('Retrying soon');
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('gave up');
  process.exitCode = 1;
}

await run();
