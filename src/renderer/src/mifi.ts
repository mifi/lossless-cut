import ky from 'ky';

import { runFfmpegStartupCheck, getFfmpegPath } from './ffmpeg';
import Swal from './swal';
import { handleError } from './util';
import isDev from './isDev';


export async function loadMifiLink() {
  try {
    // In old versions: https://mifi.no/losslesscut/config.json
    return await ky('https://losslesscut.mifi.no/config.json').json();
    // return await ky('http://localhost:8080/losslesscut/config-dev.json').json();
  } catch (err) {
    if (isDev) console.error(err);
    return undefined;
  }
}

export async function runStartupCheck({ customFfPath }: { customFfPath: string | undefined }) {
  try {
    await runFfmpegStartupCheck();
  } catch (err) {
    if (err instanceof Error) {
      if (!customFfPath && 'code' in err && typeof err.code === 'string' && ['EPERM', 'EACCES'].includes(err.code)) {
        Swal.fire({
          icon: 'error',
          title: 'Fatal: ffmpeg not accessible',
          text: `Got ${err.code}. This probably means that anti-virus is blocking execution of ffmpeg. Please make sure the following file exists and is executable:\n\n${getFfmpegPath()}\n\nSee this issue: https://github.com/mifi/lossless-cut/issues/1114`,
        });
        return;
      }

      if (customFfPath && 'code' in err && err.code === 'ENOENT') {
        Swal.fire({
          icon: 'error',
          title: 'Fatal: ffmpeg not found',
          text: `Make sure that ffmpeg executable exists: ${getFfmpegPath()}`,
        });
        return;
      }
    }

    handleError('Fatal: ffmpeg non-functional', err);
  }
}
