import { DefaultArtifactClient } from '@actions/artifact';
import assert from 'node:assert';
import { basename } from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';


const args = yargs(hideBin(process.argv))
  .option('name', {
    type: 'string',
  })
  .parseSync();

assert(args._.length > 0, 'Please provide one or more files');

const client = new DefaultArtifactClient();

const name = args.name ?? basename(String(args._[0]));

await client.uploadArtifact(
  name,
  args._.map(String),
  process.cwd(), // root directory
);
