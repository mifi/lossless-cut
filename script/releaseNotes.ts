// Collects `Changelog:` commit trailers (see AGENTS.md) since the last tag, or since the ref given as argument.
// Usage: yarn release-notes [from-ref]
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const git = async (...args: string[]) => (await promisify(execFile)('git', args)).stdout.trim();

const from = process.argv[2] ?? await git('describe', '--tags', '--abbrev=0');

const log = await git('log', '--reverse', '--format=%(trailers:key=Changelog,valueonly,unfold)', `${from}..HEAD`);

console.log(`Changes since ${from}:\n`);
log.split('\n').filter((line) => line.trim() !== '').forEach((line) => console.log(`- ${line.trim()}`));
