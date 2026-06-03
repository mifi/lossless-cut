import { execa } from 'execa';
import assert from 'node:assert';
import { DateTime } from 'luxon';

// Find the most recent tag that starts with `v` (if any)
const ps1 = await execa('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*']);
const tag = ps1.stdout.trim();
assert(tag, 'Tag not found');

// Use record separator (RS) and field separator (FS) to split commits and fields reliably
const RS = '\u001E';
const FS = '\u001F';
const format = `%H${FS}%cI${FS}%an <%ae>${FS}%B${RS}`;

const args = tag ? ['log', `${tag}..HEAD`, `--pretty=format:${format}`] : ['log', `--pretty=format:${format}`];
const ps2 = await execa('git', args);
assert(ps2.stdout);

const commits = ps2.stdout
  .split(RS)
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [hash, date, author, ...bodyParts] = s.split(FS);
    assert(date);
    const body = bodyParts.join(FS).trim();
    return { hash: hash?.trim(), date: date?.trim(), author: author?.trim(), message: body };
  });

const out = commits
  .filter((c) => (
    !c.author?.startsWith('dependabot[bot] ')
    && !c.message.startsWith('Translated using Weblate')
    && !c.message.startsWith('Merge pull request')
  ))
  .map((c) => `https://github.com/mifi/lossless-cut/commit/${c.hash}\n${DateTime.fromISO(c.date).toISODate()} - ${c.author}\n\n${c.message}`)
  .join('\n\n\n------\n');

console.log(out);
