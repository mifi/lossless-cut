import { useCallback } from 'react';
import i18n from 'i18next';
import invariant from 'tiny-invariant';

import { getOutDir, getFileDir, checkDirWriteAccess, dirExists, isMasBuild } from '../util';
import { askForOutDir, askForInputDir } from '../dialogs';
import { errorToast } from '../swal';
// import isDev from '../isDev';

export class DirectoryAccessDeclinedError extends Error {
  constructor() {
    super();
    this.name = 'DirectoryAccessDeclinedError';
  }
}

// MacOS App Store sandbox doesn't allow reading/writing anywhere,
// except those exact file paths that have been explicitly drag-dropped into LosslessCut or opened using the opener dialog
// Therefore we set the flag com.apple.security.files.user-selected.read-write
// With this flag, we can show the user an open-dialog for a **directory**, and once the user has opened that directory, we can read/write files in this directory until the app is restarted.
// NOTE! fs.stat is still allowed everywhere, even though read/write is not
// see also developer-notes.md

// const simulateMasBuild = isDev; // can be used for testing this logic without having to build mas-dev
const simulateMasBuild = false;

const masMode = isMasBuild || simulateMasBuild;

export default ({ setCustomOutDir }: { setCustomOutDir: (a: string | undefined) => void }) => {
  const ensureAccessToSourceDir = useCallback(async (inputPath: string) => {
    // Called if we need to read/write to the source file's directory (probably to read/write the project file)
    const inputFileDir = getFileDir(inputPath);
    invariant(inputFileDir != null);

    let simulateMasPermissionError = simulateMasBuild;

    // If we are MAS, we need to loop try to make the user confirm the dialog with the same path as the defaultPath.
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      if (await checkDirWriteAccess(inputFileDir) && !simulateMasPermissionError) break;

      if (!masMode) {
        // don't know what to do; fail right away
        errorToast(i18n.t('You have no write access to the directory of this file'));
        throw new DirectoryAccessDeclinedError();
      }

      // We are now mas, so we need to try to encourage the user to allow access to the dir
      // eslint-disable-next-line no-await-in-loop
      const userSelectedDir = await askForInputDir(inputFileDir);

      // allow user to cancel:
      if (userSelectedDir == null) throw new DirectoryAccessDeclinedError();

      simulateMasPermissionError = false; // assume user chose the right dir
    }
  }, []);

  const ensureWritableOutDir = useCallback(async ({ inputPath, outDir }: { inputPath: string | undefined, outDir: string | undefined }) => {
    // we might need to change the output directory if the user chooses to give us a different one.
    let newCustomOutDir = outDir;

    if (newCustomOutDir) {
      // Reset if working directory doesn't exist anymore
      const customOutDirExists = await dirExists(newCustomOutDir);
      if (!customOutDirExists) {
        setCustomOutDir(undefined);
        newCustomOutDir = undefined;
      }
    }

    if (!newCustomOutDir && !inputPath) return newCustomOutDir;

    const effectiveOutDirPath = getOutDir(newCustomOutDir, inputPath);
    const hasDirWriteAccess = await checkDirWriteAccess(effectiveOutDirPath);
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
};
