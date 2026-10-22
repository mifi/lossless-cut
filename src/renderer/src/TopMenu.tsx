import type { CSSProperties, ReactNode } from 'react';
import { memo, useCallback, useEffect, useRef } from 'react';
import { IoIosSettings } from 'react-icons/io';
import { FaFilter, FaList, FaLock, FaMoon, FaSun, FaUnlock } from 'react-icons/fa';
import { FiScissors } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import Button from './components/Button';

import ExportModeButton from './components/ExportModeButton';
import ExportButton from './components/ExportButton';
import KeepRemoveToggle from './components/KeepRemoveToggle';
import WindowControls, { AppMenuButton, customTitleBar } from './components/WindowControls';

import { withBlur } from './util';
import { primaryTextColor, darkModeTransition } from './colors';
import { basename } from './util/path';
import type { SegmentToExport } from './types';
import useUserSettings from './hooks/useUserSettings';
import useActionTitle from './hooks/useActionTitle';
import styles from './TopMenu.module.css';
import OutDirSelector from './components/OutDirSelector';


const { stat } = window.require('node:fs/promises');
const { webUtils } = window.require('electron');

const outFmtStyle = { maxWidth: 130 };
const exportModeStyle = { flexGrow: 0, flexBasis: 140 };

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
  fileInfo,
  segmentsToExport,
  areWeCutting,
  onExportPress,
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
  fileInfo: string | undefined,
  segmentsToExport: SegmentToExport[],
  areWeCutting: boolean,
  onExportPress: () => void,
}) {
  const { t } = useTranslation();
  const { customOutDir, setCustomOutDir, simpleMode, outFormatLocked, setOutFormatLocked, darkMode } = useUserSettings();
  const actionTitle = useActionTitle();
  const workingDirButtonRef = useRef<HTMLButtonElement>(null);

  const DarkMode = darkMode ? FaSun : FaMoon;

  const onOutFormatLockedClick = useCallback(() => setOutFormatLocked((v) => (v ? undefined : fileFormat)), [fileFormat, setOutFormatLocked]);

  const showClearWorkingDirButton = !!customOutDir;

  function renderFormatLock() {
    const Icon = outFormatLocked ? FaLock : FaUnlock;
    return (
      <Button>
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
      className={`no-user-select llc-panel ${styles['wrapper']}`}
      style={{ transition: darkModeTransition }}
    >
      {customTitleBar && <AppMenuButton />}

      <div className={styles['brand']}>
        <div className={styles['logo']}><FiScissors /></div>
        <div style={{ minWidth: 0 }}>
          <div className={styles['fileName']} title={filePath}>{filePath ? basename(filePath) : 'LosslessCut'}</div>
          {fileInfo && <div className={styles['fileInfo']}>{fileInfo}</div>}
        </div>
      </div>

      <div style={{ flexGrow: 1 }} />

      {filePath && <KeepRemoveToggle />}

      <div style={{ flexGrow: 1 }} />

      {filePath && (
        <>
          <Button onClick={withBlur(() => setStreamsSelectorShown(true))}>
            <FaList style={{ fontSize: '.8em' }} />
            {t('Tracks')} ({numStreamsToCopy}/{numStreamsTotal})
          </Button>

          {enabledStreamsFilter != null && (
            <Button
              onClick={withBlur(() => applyEnabledStreamsFilter())}
              title={actionTitle(t('Toggle tracks using current filter'), 'toggleStripCurrentFilter')}
            >
              <FaFilter style={{ fontSize: '.8em' }} />
            </Button>
          )}

          <Button
            onClick={changeEnabledStreamsFilter}
          >
            {enabledStreamsFilter == null && <FaFilter style={{ fontSize: '.8em' }} />}
            {t('Filter tracks')}
          </Button>
        </>
      )}

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
        <Button onClick={toggleDarkMode} title={actionTitle(t('Toggle dark mode'), 'toggleDarkMode')}>
          <DarkMode style={{ fontSize: '.9em' }} />
        </Button>
      )}

      <Button onClick={toggleSettings} title={actionTitle(t('Settings'), 'toggleSettings')}>
        <IoIosSettings style={{ fontSize: '1.1em' }} />
      </Button>

      {filePath && (
        <ExportButton segmentsToExport={segmentsToExport} areWeCutting={areWeCutting} onClick={withBlur(onExportPress)} />
      )}

      {customTitleBar && <WindowControls />}
    </div>
  );
}

export default memo(TopMenu);
