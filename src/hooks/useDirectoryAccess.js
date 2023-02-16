import { useCallback } from 'react';
import i18n from 'i18next';

import { getOutDir, getFileDir, checkDirWriteAccess, dirExists, isMasBuild } from '../util';
import { askForOutDir, askForInputDir } from '../dialogs';
import { errorToast } from '../swal';
// eslint-disable-next-line no-unused-vars
import isDev from '../isDev';


export default ({ customOutDir, setCustomOutDir }) => {
  // MacOS App Store sandbox doesn't allow writing anywhere, and we set the flag com.apple.security.files.user-selected.read-write
  // With this flag, we can show the user an open-dialog for a directory, and once the user has opened that directory, we can write files there until the app is restarted.
  // NOTE: when MAS (dev) build, Application Support will instead be here:
  // ~/Library/Containers/no.mifi.losslesscut-mac/Data/Library/Application Support
  // To start from scratch: rm -rf ~/Library/Containers/no.mifi.losslesscut-mac
  const ensureWritableDirs = useCallback(async ({ inputPath, checkInputDir }) => {
    // const simulateMasBuild = isDev; // can be used for testing this logic without having to build mas-dev
    const simulateMasBuild = false;

    const masMode = isMasBuild || simulateMasBuild;

    // First check input file's directory, but only if we need to write to it (probably to write the project file)
    if (checkInputDir) {
      const inputFileDir = getFileDir(inputPath);
      let simulateMasPermissionError = simulateMasBuild;
      for (;;) {
        // eslint-disable-next-line no-await-in-loop
        if (await checkDirWriteAccess(inputFileDir) && !simulateMasPermissionError) break;

        if (!masMode) {
          // don't know what to do; fail right away
          errorToast(i18n.t('You have no write access to the directory of this file'));
          return { canceled: true };
        }

        // We are now mas, so we need to try to encourage the user to allow access to the dir, so we can write the project file later
        // eslint-disable-next-line no-await-in-loop
        const userSelectedDir = await askForInputDir(inputFileDir);
        simulateMasPermissionError = false; // assume user chose the right dir
        if (userSelectedDir == null) return { canceled: true }; // allow user to cancel
      }
    }

    // Now we have (optionally) checked input path. Need to also check working dir
    let newCustomOutDir = customOutDir;

    // Reset if doesn't exist anymore
    const customOutDirExists = await dirExists(customOutDir);
    if (!customOutDirExists) {
      setCustomOutDir(undefined);
      newCustomOutDir = undefined;
    }

    const effectiveOutDirPath = getOutDir(newCustomOutDir, inputPath);
    const hasDirWriteAccess = await checkDirWriteAccess(effectiveOutDirPath);
    if (!hasDirWriteAccess || simulateMasBuild) {
      if (masMode) {
        const newOutDir = await askForOutDir(effectiveOutDirPath);
        // If user canceled open dialog, refuse to continue, because we will get permission denied error from MAS sandbox
        if (!newOutDir) return { canceled: true };
        setCustomOutDir(newOutDir);
        newCustomOutDir = newOutDir;
      } else {
        errorToast(i18n.t('You have no write access to the directory of this file, please select a custom working dir'));
        setCustomOutDir(undefined);
        return { canceled: true };
      }
    }

    return { canceled: false, newCustomOutDir };
  }, [customOutDir, setCustomOutDir]);


  return {
    ensureWritableDirs,
  };
};
