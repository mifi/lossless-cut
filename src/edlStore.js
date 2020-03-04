import parse from 'csv-parse';
import stringify from 'csv-stringify';

const fs = window.require('fs-extra');
const { promisify } = window.require('util');

const stringifyAsync = promisify(stringify);
const parseAsync = promisify(parse);

export async function load(path) {
  const str = await fs.readFile(path, 'utf-8');
  const rows = await parseAsync(str, {});
  if (rows.length === 0) throw new Error('No rows found');
  if (!rows.every(row => row.length === 3)) throw new Error('One or more rows does not have 3 columns');

  const mapped = rows
    .map(([start, end, name]) => ({
      start: start === '' ? undefined : parseFloat(start, 10),
      end: end === '' ? undefined : parseFloat(end, 10),
      name,
    }));

  if (!mapped.every(({ start, end }) => (
    (start === undefined || !Number.isNaN(start))
    && (end === undefined || !Number.isNaN(end))
  ))) {
    console.log(mapped);
    throw new Error('Invalid start or end value. Must contain a number of seconds');
  }

  return mapped;
}

export async function save(path, cutSegments) {
  console.log('Saving', path);
  const rows = cutSegments.map(({ start, end, name }) => [start, end, name]);
  const str = await stringifyAsync(rows);
  await fs.writeFile(path, str);
}
