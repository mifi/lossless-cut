import { it, expect } from 'vitest';

import { readFixture } from './test/util';
import { parseEdlCmx3600 } from './edlFormats';


it('parseEdlCmx3600', async () => {
  const fps = 30;
  expect(await parseEdlCmx3600(await readFixture('edl/12_16 TL01 MUSIC.edl'), fps)).toMatchSnapshot();
  expect(await parseEdlCmx3600(await readFixture('edl/070816_EG101_HEISTS_ROUGH_CUT_SOURCES_PART 1.edl'), fps)).toMatchSnapshot();
  expect(await parseEdlCmx3600(await readFixture('edl/cmx3600_5994.edl'), fps)).toMatchSnapshot();
  expect(await parseEdlCmx3600(await readFixture('edl/cmx3600.edl'), fps)).toMatchSnapshot();
  expect(await parseEdlCmx3600(await readFixture('edl/pull001_201109_exr.edl'), fps)).toMatchSnapshot();
});
