// Collects `Changelog:` lines (see AGENTS.md) from commit messages since the last release tag, or since the ref given as argument.
// Usage: yarn release-notes [from-ref]
import { execa } from 'execa';

const from = process.argv[2] ?? (await execa('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*'])).stdout.trim();

// Match anywhere in the message, not just git's trailer block (which is only the last paragraph)
const { stdout } = await execa('git', ['log', '--reverse', '--format=%B', `${from}..HEAD`]);
// without duplicates (e.g. the same line in several commits of a pull request)
// eslint-disable-next-line unicorn-js/prefer-iterator-to-array -- TODO fix (new rule in @mifi/lint-config)
const notes = [...new Set([...stdout.matchAll(/^changelog\s*:\s*(.+)$/gim)].map(([, note]) => note!.trim()))];

console.log(`Changes since ${from}:\n`);
console.log(notes.length > 0 ? notes.map((note) => `- ${note}`).join('\n') : '(none found)');
