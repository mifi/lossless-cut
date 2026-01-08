import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import semver from 'semver';
import { FaCode, FaFile } from 'react-icons/fa';
import Markdown from 'react-markdown';

import * as Dialog from './Dialog';
import useUserSettings from '../hooks/useUserSettings';
import { appVersion, isMasBuild } from '../util';
import versionsJson from '../versions.json';
import Button from './Button';

import styles from './WhatsNew.module.css';
import { compareReleasesUrl, getReleaseUrl } from '../../../common/constants';


// see also generateVersions.ts
const versions: { version: string, highlightsMd?: string | undefined }[] = versionsJson;

const remote = window.require('@electron/remote');
const { shell } = remote;

export default function WhatsNew() {
  const { t } = useTranslation();
  const { lastAppVersion, setLastAppVersion } = useUserSettings();

  const [initialLastAppVersion] = useState(lastAppVersion);

  useEffect(() => {
    setLastAppVersion(appVersion);
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
            {matchingVersions.map(({ version, highlightsMd }, i) => {
              // +1 because reverse order
              const prevVersion = matchingVersions[i + 1]?.version ?? initialLastAppVersion;

              return (
                <div key={version} className={styles['version']}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1em' }}>
                    {!(isMasBuild && matchingVersions.length === 1) && <h2>v{version}</h2>}
                    <Button onClick={() => shell.openExternal(getReleaseUrl(version))}><FaFile style={{ verticalAlign: 'middle' }} /> {t('All release notes')}</Button>
                    <Button onClick={() => shell.openExternal(compareReleasesUrl(prevVersion, version))}><FaCode style={{ verticalAlign: 'middle' }} /> {t('All code changes')}</Button>
                  </div>


                  {highlightsMd != null && (
                    <Markdown
                      components={{
                        // eslint-disable-next-line react/no-unstable-nested-components
                        code(props) {
                          // eslint-disable-next-line react/jsx-props-no-spreading
                          return <code className="highlighted" {...props} />;
                        },
                      }}
                    >
                      {highlightsMd}
                    </Markdown>
                  )}
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
