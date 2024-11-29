import { CSSProperties, ReactNode, memo, useCallback, useEffect, useRef } from 'react';
import { IoIosSettings } from 'react-icons/io';
import { FaLock, FaUnlock } from 'react-icons/fa';
import { CrossIcon, ListIcon, VolumeUpIcon, VolumeOffIcon } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';
import Button from './components/Button';

import ExportModeButton from './components/ExportModeButton';

import { withBlur } from './util';
import { primaryTextColor, controlsBackground, darkModeTransition } from './colors';
import useUserSettings from './hooks/useUserSettings';
import { InverseCutSegment } from './types';


const { stat } = window.require('fs/promises');
const { webUtils } = window.require('electron');

const outFmtStyle = { height: 20, maxWidth: 100 };
const exportModeStyle = { flexGrow: 0, flexBasis: 140 };

function TopMenu({
  filePath,
  fileFormat,
  copyAnyAudioTrack,
  toggleStripAudio,
  renderOutFmt,
  numStreamsToCopy,
  numStreamsTotal,
  setStreamsSelectorShown,
  toggleSettings,
  selectedSegments,
  isCustomFormatSelected,
  clearOutDir,
}: {
  filePath: string | undefined,
  fileFormat: string | undefined,
  copyAnyAudioTrack: boolean,
  toggleStripAudio: () => void,
  renderOutFmt: (style: CSSProperties) => ReactNode,
  numStreamsToCopy: number,
  numStreamsTotal: number,
  setStreamsSelectorShown: (v: boolean) => void,
  toggleSettings: () => void,
  selectedSegments: InverseCutSegment[],
  isCustomFormatSelected: boolean,
  clearOutDir: () => void,
}) {
  const { t } = useTranslation();
  const { customOutDir, changeOutDir, setCustomOutDir, simpleMode, outFormatLocked, setOutFormatLocked } = useUserSettings();
  const workingDirButtonRef = useRef<HTMLButtonElement>(null);

  const onOutFormatLockedClick = useCallback(() => setOutFormatLocked((v) => (v ? undefined : fileFormat)), [fileFormat, setOutFormatLocked]);

  const showClearWorkingDirButton = !!customOutDir;

  function renderFormatLock() {
    const Icon = outFormatLocked ? FaLock : FaUnlock;
    return <Icon onClick={onOutFormatLockedClick} title={t('Lock/unlock output format')} size={14} style={{ marginRight: 7, marginLeft: 2, color: outFormatLocked ? primaryTextColor : undefined }} />;
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
      className="no-user-select"
      style={{ background: controlsBackground, transition: darkModeTransition, display: 'flex', alignItems: 'center', padding: '3px 5px', justifyContent: 'space-between', flexWrap: 'wrap' }}
    >
      {filePath && (
        <>
          <Button onClick={withBlur(() => setStreamsSelectorShown(true))}>
            <ListIcon size={'1em' as unknown as number} verticalAlign="middle" marginRight=".3em" />
            {t('Tracks')} ({numStreamsToCopy}/{numStreamsTotal})
          </Button>

          <Button
            title={copyAnyAudioTrack ? t('Keep audio tracks') : t('Discard audio tracks')}
            onClick={withBlur(toggleStripAudio)}
          >
            {copyAnyAudioTrack ? (
              <><VolumeUpIcon size={'1em' as unknown as number} verticalAlign="middle" marginRight=".3em" />{t('Keep audio')}</>
            ) : (
              <><VolumeOffIcon size={'1em' as unknown as number} verticalAlign="middle" marginRight=".3em" />{t('Discard audio')}</>
            )}
          </Button>
        </>
      )}

      <div style={{ flexGrow: 1 }} />

      {showClearWorkingDirButton && (
        <CrossIcon
          role="button"
          tabIndex={0}
          style={{ width: 20 }}
          onClick={withBlur(clearOutDir)}
          title={t('Clear working directory')}
        />
      )}

      <Button
        ref={workingDirButtonRef}
        onClick={withBlur(changeOutDir)}
        title={customOutDir}
        style={{ paddingLeft: showClearWorkingDirButton ? 4 : undefined }}
      >
        {customOutDir ? t('Working dir set') : t('Working dir unset')}
      </Button>

      {filePath && (
        <>
          {renderOutFmt(outFmtStyle)}

          {!simpleMode && (isCustomFormatSelected || outFormatLocked) && renderFormatLock()}

          <ExportModeButton selectedSegments={selectedSegments} style={exportModeStyle} />
        </>
      )}

      <IoIosSettings size={24} role="button" onClick={toggleSettings} style={{ marginLeft: 5 }} />
    </div>
  );
}

export default memo(TopMenu);
