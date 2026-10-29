// The GitHub star count for the homepage, fetched once per build (or dev server).
// Without a token, the GitHub API allows only 60 requests per hour per IP, which CI and Cloudflare's build servers share
// with others, so GITHUB_TOKEN is used when set. If the request fails anyway, the last known count is shown instead.
const fallbackStars = 44_000;

async function fetchStars() {
  try {
    const token = process.env['GITHUB_TOKEN'];
    const response = await fetch('https://api.github.com/repos/mifi/lossless-cut', {
      headers: { accept: 'application/vnd.github+json', ...(token && { authorization: `Bearer ${token}` }) },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { stargazers_count: stars } = await response.json();
    if (typeof stars !== 'number') throw new Error('No stargazers_count');
    return stars;
  } catch (err) {
    console.warn(`Could not get the GitHub star count, using ${fallbackStars}:`, err instanceof Error ? err.message : err);
    return fallbackStars;
  }
}

let starsPromise: Promise<number> | undefined;

export default function getGithubStars() {
  starsPromise ??= fetchStars();
  return starsPromise;
}
