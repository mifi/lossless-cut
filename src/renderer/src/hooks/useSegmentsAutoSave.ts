import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDebounce } from 'use-debounce';
import isEqual from 'lodash/isEqual';

import isDev from '../isDev';
import { saveLlcProject } from '../edlStore';
import { getCleanCutSegments } from '../segments';
import { getSuffixedOutPath } from '../util';
import { StateSegment } from '../types';
import { errorToast } from '../swal';
import i18n from '../i18n';


export default ({ autoSaveProjectFile, storeProjectInWorkingDir, filePath, customOutDir, cutSegments }: {
  autoSaveProjectFile: boolean,
  storeProjectInWorkingDir: boolean,
  filePath: string | undefined,
  customOutDir: string | undefined,
  cutSegments: StateSegment[],
}) => {
  const projectSuffix = 'proj.llc';
  // New LLC format can be stored along with input file or in working dir (customOutDir)
  const getEdlFilePath = useCallback((fp?: string, cod?: string) => getSuffixedOutPath({ customOutDir: cod, filePath: fp, nameSuffix: projectSuffix }), []);
  const getProjectFileSavePath = useCallback((storeProjectInWorkingDirIn: boolean) => getEdlFilePath(filePath, storeProjectInWorkingDirIn ? customOutDir : undefined), [getEdlFilePath, filePath, customOutDir]);
  const projectFileSavePath = useMemo(() => getProjectFileSavePath(storeProjectInWorkingDir), [getProjectFileSavePath, storeProjectInWorkingDir]);

  const currentSaveOperation = useMemo(() => {
    if (!projectFileSavePath) return undefined;
    return { cutSegments, projectFileSavePath, filePath };
  }, [cutSegments, filePath, projectFileSavePath]);

  const [debouncedSaveOperation] = useDebounce(currentSaveOperation, isDev ? 2000 : 500);

  const lastSaveOperation = useRef<typeof debouncedSaveOperation>();

  useEffect(() => {
    async function save() {
      try {
        // NOTE: Could lose a save if user closes too fast, but not a big issue I think
        if (!autoSaveProjectFile || !debouncedSaveOperation) return;

        // Don't create llc file if no segments yet, or if initial segment:
        if (debouncedSaveOperation.cutSegments.length === 0 || debouncedSaveOperation.cutSegments[0]?.initial) return;

        if (lastSaveOperation.current && lastSaveOperation.current.projectFileSavePath === debouncedSaveOperation.projectFileSavePath && isEqual(getCleanCutSegments(lastSaveOperation.current.cutSegments), getCleanCutSegments(debouncedSaveOperation.cutSegments))) {
          console.log('Segments unchanged, skipping save');
          return;
        }
        if (debouncedSaveOperation.filePath == null) {
          return;
        }

        await saveLlcProject({ savePath: debouncedSaveOperation.projectFileSavePath, filePath: debouncedSaveOperation.filePath, cutSegments: debouncedSaveOperation.cutSegments });
        lastSaveOperation.current = debouncedSaveOperation;
      } catch (err) {
        errorToast(i18n.t('Unable to save project file'));
        console.error('Failed to save project file', err);
      }
    }
    save();
  }, [debouncedSaveOperation, autoSaveProjectFile]);

  return {
    getEdlFilePath,
    projectFileSavePath,
    getProjectFileSavePath,
  };
};
