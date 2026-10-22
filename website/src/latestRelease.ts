// The latest GitHub release's version and date for the homepage, fetched once per build (or dev server), like githubStars.ts.
// If the request fails, the homepage leaves them out.
export interface Release { version: string, date: Date }

async function fetchLatestRelease(): Promise<Release | undefined> {
  try {
    const token = process.env['GITHUB_TOKEN'];
    const response = await fetch('https://api.github.com/repos/mifi/lossless-cut/releases/latest', {
      headers: { accept: 'application/vnd.github+json', ...(token && { authorization: `Bearer ${token}` }) },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { tag_name: tag, published_at: publishedAt } = await response.json();
    if (typeof tag !== 'string' || typeof publishedAt !== 'string') throw new Error('No tag_name or published_at');
    return { version: tag.replace(/^v/, ''), date: new Date(publishedAt) };
  } catch (err) {
    console.warn('Could not get the latest GitHub release, leaving it out:', err instanceof Error ? err.message : err);
    return undefined;
  }
}

let releasePromise: Promise<Release | undefined> | undefined;

export default function getLatestRelease() {
  releasePromise ??= fetchLatestRelease();
  return releasePromise;
}
