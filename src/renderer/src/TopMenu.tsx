import type { CSSProperties, ReactNode } from 'react';
import { memo, useCallback, useEffect, useRef } from 'react';
import { IoIosSettings } from 'react-icons/io';
import { FaFilter, FaList, FaLock, FaMoon, FaSun, FaUnlock } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import Button from './components/Button';

import ExportModeButton from './components/ExportModeButton';

import { withBlur } from './util';
import { primaryTextColor } from './colors';
import useUserSettings from './hooks/useUserSettings';
import styles from './TopMenu.module.css';
import OutDirSelector from './components/OutDirSelector';


const { stat } = window.require('fs/promises');
const { webUtils } = window.require('electron');

const outFmtStyle = { minWidth: 210, maxWidth: 320, width: 'auto' as const };
const exportModeStyle = { flexGrow: 0, flexBasis: 210, minWidth: 210 };

function TopMenu({
  filePath,
  fileFormat,
  changeEnabledStreamsFilter,
  applyEnabledStreamsFilter,
  enabledStreamsFilter,
  renderOutFmt,
  numStreamsToCopy,
  numStreamsTotal,
  setStreamsSelectorShown,
  toggleSettings,
  selectedSegments,
  isCustomFormatSelected,
  toggleDarkMode,
}: {
  filePath: string | undefined,
  fileFormat: string | undefined,
  changeEnabledStreamsFilter: () => void,
  applyEnabledStreamsFilter: () => void,
  enabledStreamsFilter: string | undefined,
  renderOutFmt: (style: CSSProperties) => ReactNode,
  numStreamsToCopy: number,
  numStreamsTotal: number,
  setStreamsSelectorShown: (v: boolean) => void,
  toggleSettings: () => void,
  selectedSegments: unknown[],
  isCustomFormatSelected: boolean,
  toggleDarkMode: () => void,
}) {
  const { t } = useTranslation();
  const { customOutDir, setCustomOutDir, simpleMode, outFormatLocked, setOutFormatLocked, darkMode } = useUserSettings();
  const workingDirButtonRef = useRef<HTMLButtonElement>(null);

  const DarkMode = darkMode ? FaSun : FaMoon;

  const onOutFormatLockedClick = useCallback(() => setOutFormatLocked((v) => (v ? undefined : fileFormat)), [fileFormat, setOutFormatLocked]);

  const showClearWorkingDirButton = !!customOutDir;

  function renderFormatLock() {
    const Icon = outFormatLocked ? FaLock : FaUnlock;
    return (
      <Button className={styles['iconButton']} style={{ marginRight: '.2em' }}>
        <Icon onClick={onOutFormatLockedClick} title={t('Lock/unlock output format')} style={{ fontSize: '.8em', color: outFormatLocked ? primaryTextColor : undefined }} />
      </Button>
    );
  }

  // Convenience for drag and drop: https://github.com/mifi/lossless-cut/issues/2147
  useEffect(() => {
    async function onDrop(ev: DragEvent) {
      ev.preventDefault();
      if (!ev.dataTransfer) return;
      const paths = [...ev.dataTransfer.files].map((f) => webUtils.getPathForFile(f));
      const [firstPath] = paths;
      if (paths.length === 1 && firstPath && (await stat(firstPath)).isDirectory()) {
        setCustomOutDir(firstPath);
      }
    }
    const element = workingDirButtonRef.current;
    element?.addEventListener('drop', onDrop);
    return () => element?.removeEventListener('drop', onDrop);
  }, [setCustomOutDir]);

  return (
    <div
      className={`no-user-select ${styles['wrapper']}`}
    >
      {filePath && (
        <>
          <Button onClick={withBlur(() => setStreamsSelectorShown(true))}>
            <FaList style={{ fontSize: '.7em', marginRight: '.5em' }} />
            {t('Tracks')} ({numStreamsToCopy}/{numStreamsTotal})
          </Button>

          {enabledStreamsFilter != null && (
            <Button
              onClick={withBlur(() => applyEnabledStreamsFilter())}
              title={t('Toggle tracks using current filter')}
            >
              <FaFilter
                style={{ fontSize: '.8em', verticalAlign: 'middle' }}
              />
            </Button>
          )}

          <Button
            onClick={changeEnabledStreamsFilter}
          >
            {enabledStreamsFilter == null && <FaFilter style={{ fontSize: '.7em', marginRight: '.4em' }} />}
            {t('Filter tracks')}
          </Button>
        </>
      )}

      <div className={styles['spacer']} />

      <OutDirSelector>
        <Button
          ref={workingDirButtonRef}
          title={customOutDir}
          style={{ paddingLeft: showClearWorkingDirButton ? '.4em' : undefined }}
        >
          {customOutDir ? t('Working dir set') : t('Working dir unset')}
        </Button>
      </OutDirSelector>

      {renderOutFmt(outFmtStyle)}

      {!simpleMode && (isCustomFormatSelected || outFormatLocked) && renderFormatLock()}

      {filePath && (
        <ExportModeButton selectedSegments={selectedSegments} style={exportModeStyle} />
      )}

      {!simpleMode && (
        <Button className={styles['iconButton']} onClick={toggleDarkMode} title={t('Toggle dark mode')}>
          <DarkMode style={{ verticalAlign: 'middle', fontSize: '.9em' }} />
        </Button>
      )}

      <Button className={styles['iconButton']} onClick={toggleSettings}>
        <IoIosSettings style={{ fontSize: '1em', verticalAlign: 'bottom' }} />
      </Button>
    </div>
  );
}

export default memo(TopMenu);
