import { readFile, writeFile } from 'fs/promises';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { DateTime } from 'luxon';

const xmlUrl = new URL('../no.mifi.losslesscut.appdata.xml', import.meta.url);
const xmlData = await readFile(xmlUrl);

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url)) as unknown as string);

const parser = new XMLParser({ alwaysCreateTextNode: true, ignoreAttributes: false, ignoreDeclaration: false });
const xml = parser.parse(xmlData);
// console.log(xml);

const { version } = packageJson;

xml.component.releases.release = [{ '@_version': version, '@_date': DateTime.now().toISODate() }, ...xml.component.releases.release];

const builder = new XMLBuilder({ format: true, ignoreAttributes: false, suppressEmptyNode: true });
await writeFile(xmlUrl, builder.build(xml));
