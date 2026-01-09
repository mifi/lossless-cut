import { execa } from 'execa';

const { stdout } = await execa('yarn', ['licenses', 'list', '-R', '--json'], { encoding: 'utf8' });

const licensesJson: { value: string; children: Record<string, unknown> }[] = JSON.parse(`[${stdout.split('\n').join(',')}]`);

const safeLicenses: Record<string, true | string[]> = {
  // These aim to remove almost all restrictions
  'CC0-1.0': true,
  Unlicense: true,
  WTFPL: true,
  '0BSD': true,

  // Permissive licenses: These impose minimal requirements (mostly attribution + license notice). You can generally use them interchangeably in commercial and proprietary software.
  MIT: true,
  'BSD-2-Clause': true,
  'BSD-3-Clause': true,
  ISC: true,
  Zlib: true,
  'Python-2.0': true,
  'BlueOak-1.0.0': true,
  'MIT/X11': true,

  // Permissive licenses with some conditions
  'Apache-2.0': true,

  // Copyleft licenses: These require that derivative works be distributed under the same license terms. They ensure that modifications remain open source.
  // which is OK because LosslessCut is also GPL-2.0-only
  'GPL-2.0-only': ['lossless-cut'],
  // Weak copyleft licenses: These allow linking with proprietary software under certain conditions, making them more flexible than strong copyleft licenses.
  'LGPL-3.0-only': true,
  'LGPL-3.0-or-later': true,
  'MPL-2.0': true,

  // Special purpose licenses
  'Hippocratic-2.1': ['@react-leaflet/core', 'react-leaflet'],

  // not software licenses
  'CC-BY-3.0': ['spdx-exceptions'], // eslint-plugin-unicorn
  'CC-BY-4.0': ['caniuse-lite'],

  // Font licenses
  'OFL-1.1': true, // permissive

  UNKNOWN: ['fast-shallow-equal', 'react-universal-interface', 'buffers'],
};

const unsafeLicenses = licensesJson.flatMap((l) => {
  const checkLicense = (license: string) => {
    const safeLicense = safeLicenses[license];
    if (safeLicense === true) {
      return true;
    }
    if (safeLicense == null) {
      return false;
    }
    return Object.keys(l.children).every((pkg) => (
      safeLicense.some((safeLicensePackage) => pkg.startsWith(safeLicensePackage))
    ));
  };

  // e.g. "(BSD-2-Clause OR MIT OR Apache-2.0)"
  // e.g. "(LGPL-3.0-only AND MIT)"
  const trimmed = l.value.replace(/^\(/, '').replace(/\)$/, '');

  const isOr = l.value.includes(' OR ');
  const isAnd = l.value.includes(' AND ');

  if (isOr || isAnd) {
    const licenses = trimmed.split(isOr ? ' OR ' : ' AND ').map((s) => s.trim());

    if (isOr) {
      return licenses.some((license) => checkLicense(license)) ? [] : [l];
    }
    if (isAnd) {
      return licenses.every((license) => checkLicense(license)) ? [] : [l];
    }
  }

  return checkLicense(trimmed) ? [] : [l];
});


if (unsafeLicenses.length > 0) {
  console.error('Found unsafe licenses:');
  console.error();

  for (const l of unsafeLicenses) {
    console.error(l.value);
    console.error(`${Object.keys(l.children).map((v) => `- ${v}`).join('\n')}`);
    console.error();
  }
  process.exitCode = 1;
} else {
  console.log('All licenses are safe.');
}
