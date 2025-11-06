import ky from 'ky';
import i18n from 'i18next';

import { runFfmpegStartupCheck, getFfmpegPath } from './ffmpeg';
import isDev from './isDev';
import { openSendReportDialog } from './reporting';
import { isMasBuild } from './util';


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

export async function runStartupCheck({ onError }: { onError: (error: { title: string, message: string }) => void }) {
  try {
    await runFfmpegStartupCheck();
  } catch (err) {
    if (err instanceof Error && !isMasBuild) {
      if ('code' in err && err.code === 'ENOENT') {
        onError({
          title: i18n.t('Fatal: FFmpeg executable not found'),
          message: `${i18n.t('Make sure that the FFmpeg executable exists:')}\n\n${getFfmpegPath()}`,
        });
        return;
      }

      if ('code' in err && typeof err.code === 'string' && ['EPERM', 'EACCES', 'ENOENT'].includes(err.code)) {
        onError({
          title: i18n.t('Fatal: FFmpeg not accessible'),
          message: [
            i18n.t('Error code: {{errorCode}}. This could mean that anti-virus or something else is blocking the execution of FFmpeg. Make sure the following file exists and is executable:', { errorCode: err.code }),
            '',
            getFfmpegPath(),
            '',
            i18n.t('Read more: {{url}}', { url: 'https://github.com/mifi/lossless-cut/issues/1114' }),
          ].join('\n'),
        });
        return;
      }
    }

    openSendReportDialog({ message: i18n.t('FFmpeg is non-functional'), err });
  }
}
