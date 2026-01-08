import { useCallback } from 'react';
import i18n from 'i18next';
import invariant from 'tiny-invariant';

import { getOutDir, getFileDir, checkDirWriteAccess, isMasBuild } from '../util';
import { askForOutDir, askForInputDir } from '../dialogs';
import { errorToast } from '../swal';
import { DirectoryAccessDeclinedError } from '../../errors';
import mainApi from '../mainApi';
// import isDev from '../isDev';


const { lstat } = window.require('fs/promises');


// MacOS App Store sandbox doesn't allow reading/writing anywhere,
// except those exact file paths that have been explicitly drag-dropped into LosslessCut or opened using the opener dialog
// Therefore we set the flag com.apple.security.files.user-selected.read-write
// With this flag, we can show the user an open-dialog for a **directory**, and once the user has opened that directory, we can read/write files in this directory until the app is restarted.
// NOTE! fs.stat is still allowed everywhere, even though read/write is not
// see also CONTRIBUTING.md

// const simulateMasBuild = isDev; // can be used for testing this logic without having to build mas-dev
const simulateMasBuild = false;

const masMode = isMasBuild || simulateMasBuild;

export default function useDirectoryAccess({ setCustomOutDir }: { setCustomOutDir: (a: string | undefined) => void }) {
  const ensureAccessToSourceDir = useCallback(async (inputPath: string) => {
    // Called if we need to read/write to the source file's directory (probably to read/write the project file)
    const inputFileDir = getFileDir(inputPath);
    invariant(inputFileDir != null);

    let simulateMasPermissionError = simulateMasBuild;

    // If we are MAS, we need to loop try to make the user confirm the dialog with the same path as the defaultPath.
    for (;;) {
      // First check if we already have access, if so, we are done
      if (await checkDirWriteAccess(inputFileDir) && !simulateMasPermissionError) break;

      // If we are not MAS, but we don't have access, then we can't do anything
      if (!masMode) {
        // so just fail right away
        errorToast(i18n.t('You have no write access to the directory of this file'));
        throw new DirectoryAccessDeclinedError();
      }

      // We are now MAS, so we need to try to encourage the user to allow access to the dir
      // If the user keeps choosing the wrong dir, we will keep asking
      // Normally Apple grants access to the dir of the file that was selected in a file open dialog or drag-droppen, but maybe the user opened a file from the batch list, for example.
      // eslint-disable-next-line no-await-in-loop
      const userSelectedDir = await askForInputDir(inputFileDir);

      // allow user to cancel:
      if (userSelectedDir == null) throw new DirectoryAccessDeclinedError();

      simulateMasPermissionError = false; // assume user chose the right dir
    }
  }, []);

  const ensureWritableOutDir = useCallback(async ({ inputPath, outDir }: { inputPath?: string | undefined, outDir: string | undefined }) => {
    // we might need to change the output directory if the user chooses to give us a different one.
    let newCustomOutDir = outDir;

    if (newCustomOutDir) {
      // Reset if working directory doesn't exist anymore
      const customOutDirExists = (await mainApi.pathExists(newCustomOutDir)) && (await lstat(newCustomOutDir)).isDirectory();
      if (!customOutDirExists) {
        setCustomOutDir(undefined);
        newCustomOutDir = undefined;
      }
    }

    // if we don't (no longer) have a working dir, and not an main file path, then there's nothing we can do, just return the dir
    if (!newCustomOutDir && !inputPath) return newCustomOutDir;

    const effectiveOutDirPath = getOutDir(newCustomOutDir, inputPath);
    const hasDirWriteAccess = effectiveOutDirPath != null && await checkDirWriteAccess(effectiveOutDirPath);
    if (!hasDirWriteAccess || simulateMasBuild) {
      if (masMode) {
        const newOutDir = await askForOutDir(effectiveOutDirPath);

        // If user canceled open dialog, refuse to continue, because we will get permission denied error from MAS sandbox
        if (!newOutDir) throw new DirectoryAccessDeclinedError();

        // OK, use the dir that the user gave us access to
        setCustomOutDir(newOutDir);
        newCustomOutDir = newOutDir;
      } else {
        errorToast(i18n.t('You have no write access to the directory of this file, please select a custom working dir'));
        setCustomOutDir(undefined);
        throw new DirectoryAccessDeclinedError();
      }
    }

    return newCustomOutDir;
  }, [setCustomOutDir]);

  return {
    ensureAccessToSourceDir,
    ensureWritableOutDir,
  };
}

export type EnsureWritableOutDir = ReturnType<typeof useDirectoryAccess>['ensureWritableOutDir'];
