import { useTranslation } from 'react-i18next';
import { useCallback, useMemo } from 'react';
import { nanoid } from 'nanoid';

import * as Dialog from './Dialog';
import useUserSettings from '../hooks/useUserSettings';
import Select from './Select';
import { DialogButton } from './Button';
import { DirectoryAccessDeclinedError } from '../../errors';

const changeMagicValue = nanoid();

export default function OutDirSelector({ children }: { children: React.ReactNode }) {
  const { customOutDir, setCustomOutDir, recentCustomOutDirs, changeOutDir, setRecentCustomOutDirs, ensureWritableOutDirWithFilePath } = useUserSettings();
  const { t } = useTranslation();

  const handleChange = useCallback<React.ChangeEventHandler<HTMLSelectElement>>(async (e) => {
    if (e.target.value === changeMagicValue) {
      changeOutDir();
    } else {
      const newOutDir = e.target.value === '' ? undefined : e.target.value;
      try {
        await ensureWritableOutDirWithFilePath({ outDir: newOutDir });
        setCustomOutDir(newOutDir);
      } catch (err) {
        if (err instanceof DirectoryAccessDeclinedError) return;
        throw err;
      }
    }
  }, [changeOutDir, ensureWritableOutDirWithFilePath, setCustomOutDir]);

  const history = useMemo(() => recentCustomOutDirs.filter((dir) => (customOutDir == null || dir !== customOutDir)), [customOutDir, recentCustomOutDirs]);

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        {children}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay />

        <Dialog.Content aria-describedby={undefined}>
          <Dialog.Title>{t('Working directory')}</Dialog.Title>
          <Dialog.Description>{t('This is where working files and exported files are stored.')}</Dialog.Description>

          <Select style={{ width: '100%' }} value={customOutDir ?? ''} onChange={handleChange}>
            <option value={changeMagicValue}>{t('Choose directory')}...</option>
            {customOutDir != null && (
              <option value={customOutDir}>{customOutDir}</option>
            )}
            <option value="">{t('Same directory as input file')}</option>
            {history.map((dir) => (
              <option key={dir} value={dir}>{dir}</option>
            ))}
          </Select>

          <Dialog.ButtonRow>
            <DialogButton onClick={() => setRecentCustomOutDirs([])}>{t('Clear recents')}</DialogButton>
            <Dialog.Close asChild>
              <DialogButton primary>{t('Done')}</DialogButton>
            </Dialog.Close>
          </Dialog.ButtonRow>

          <Dialog.CloseButton />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
