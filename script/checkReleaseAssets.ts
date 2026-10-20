// Compares the assets of a (draft) release with the latest published release, and fails if any is missing or much smaller.
// This catches e.g. a build that was packaged without ffmpeg. Run by the build workflow after a tag build.
// Usage: node script/checkReleaseAssets.ts v1.2.3 (GH_TOKEN is needed to see draft releases)
import assert from 'node:assert';

const tag = process.argv[2];
const token = process.env['GH_TOKEN'];
assert(tag != null, 'Usage: node script/checkReleaseAssets.ts <tag>');

const repo = process.env['GITHUB_REPOSITORY'] ?? 'mifi/lossless-cut';
// Sizes usually change by a few percent between releases. A failure on a draft can be checked and ignored if the size change is expected
const minRatio = 0.9;

interface Release { tag_name: string, assets: { name: string, size: number }[] }

async function get<T>(path: string) {
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, { headers: { accept: 'application/vnd.github+json', ...(token != null && { authorization: `Bearer ${token}` }) } });
  assert(response.ok, `GET ${path} failed: ${response.status}`);
  return await response.json() as T;
}

// Drafts don't have a tag yet as far as the "release by tag" endpoint is concerned, so look in the list
const release = (await get<Release[]>('releases?per_page=20')).find((r) => r.tag_name === tag);
assert(release != null, `No release found for ${tag}`);
const previous = await get<Release>('releases/latest');
assert(previous.tag_name !== tag, `${tag} is already the latest published release, nothing to compare with`);

const formatMb = (bytes: number) => `${(bytes / 1e6).toFixed(0)} MB`;
const problems = previous.assets.flatMap(({ name, size }) => {
  const asset = release.assets.find((a) => a.name === name);
  if (asset == null) return [`${name} is missing (${formatMb(size)} in ${previous.tag_name})`];
  if (asset.size < size * minRatio) return [`${name} is ${formatMb(asset.size)}, was ${formatMb(size)} in ${previous.tag_name}`];
  return [];
});

console.log(`Compared ${release.assets.length} assets of ${tag} with ${previous.tag_name}`);
for (const problem of problems) console.log(`::error::${problem}`);
process.exitCode = problems.length > 0 ? 1 : 0;
