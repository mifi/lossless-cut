import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import semver from 'semver';
import { FaCode, FaFile } from 'react-icons/fa';

import * as Dialog from './Dialog';
import useUserSettings from '../hooks/useUserSettings';
import { appVersion, isMasBuild } from '../util';
import versions from '../versions';
import Button from './Button';

const remote = window.require('@electron/remote');
const { shell } = remote;

export default function WhatsNew() {
  const { t } = useTranslation();
  const { lastAppVersion, setLastAppVersion } = useUserSettings();

  const [initialLastAppVersion] = useState(lastAppVersion);

  useEffect(() => {
    //setLastAppVersion(appVersion);
  }, [setLastAppVersion]);

  const matchingVersions = useMemo(() => versions
    .filter(({ version }) => semver.gt(version, initialLastAppVersion) && semver.lte(version, appVersion))
    .sort(({ version: a }, { version: b }) => semver.compare(b, a)), [initialLastAppVersion]);

  if (initialLastAppVersion === appVersion) return null;

  return (
    <Dialog.Root defaultOpen>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content style={{ width: '60em' }} aria-describedby={undefined}>
          <Dialog.Title>
            {t('What\'s new in LosslessCut?')}
          </Dialog.Title>

          <div>
            {matchingVersions.map(({ version, highlights }, i) => {
              // +1 because reverse order
              const prevVersion = matchingVersions[i + 1]?.version ?? initialLastAppVersion;

              return (
                <div key={version}>
                  {!(isMasBuild && matchingVersions.length === 1) && <h2>v{version}</h2>}
                  <ul>
                    {highlights?.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>

                  <Button style={{ padding: '.5em 1em' }} onClick={() => shell.openExternal(`https://github.com/mifi/lossless-cut/releases/tag/v${version}`)}><FaFile style={{ verticalAlign: 'middle' }} /> {t('All release notes')}</Button>
                  <Button style={{ padding: '.5em 1em' }} onClick={() => shell.openExternal(`https://github.com/mifi/lossless-cut/compare/v${prevVersion}...v${version}`)}><FaCode style={{ verticalAlign: 'middle' }} /> {t('All code changes')}</Button>
                </div>
              );
            })}
          </div>

          <Dialog.CloseButton />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
