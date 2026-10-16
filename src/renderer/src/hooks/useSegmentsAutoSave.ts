import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDebounce } from 'use-debounce';
import isEqual from 'lodash/isEqual';

import isDev from '../isDev';
import { saveLlcProject } from '../edlStore';
import { mapSaveableSegments } from '../segments';
import { getProjectFileSaveAction } from '../projectFileSave';
import { getSuffixedOutPath } from '../util';
import type { StateSegment } from '../types';
import { errorToast } from '../swal';
import i18n from '../i18n';

const { unlink } = window.require('node:fs/promises');


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

  // NOTE: Could lose a save if user closes too fast, but not a big issue I think
  const [debouncedSaveOperation] = useDebounce(currentSaveOperation, isDev ? 2000 : 500);

  const lastSaveOperation = useRef<typeof debouncedSaveOperation>(undefined);

  useEffect(() => {
    async function save() {
      try {
        if (!autoSaveProjectFile
          || !debouncedSaveOperation
          || debouncedSaveOperation.filePath == null
        ) {
          return;
        }

        const action = getProjectFileSaveAction({
          lastSavedProjectFileSavePath: lastSaveOperation.current?.projectFileSavePath,
          projectFileSavePath: debouncedSaveOperation.projectFileSavePath,
          cutSegments: debouncedSaveOperation.cutSegments,
        });

        if (action === 'skip') return;

        if (action === 'delete-stale') {
          // All segments were deleted after a project file was saved:
          // remove the stale project file so the deleted segments don't reappear on reopen.
          // https://github.com/mifi/lossless-cut/issues/1294
          console.log('All segments deleted, removing stale project file', debouncedSaveOperation.projectFileSavePath);
          await unlink(debouncedSaveOperation.projectFileSavePath).catch((err: unknown) => {
            // The file may already be gone; only ignore not-found errors
            if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return;
            throw err;
          });
          lastSaveOperation.current = undefined;
          return;
        }

        if (lastSaveOperation.current && lastSaveOperation.current.projectFileSavePath === debouncedSaveOperation.projectFileSavePath && isEqual(mapSaveableSegments(lastSaveOperation.current.cutSegments), mapSaveableSegments(debouncedSaveOperation.cutSegments))) {
          console.log('Segments unchanged, skipping save');
          return;
        }

        console.log('Saving project file', debouncedSaveOperation.projectFileSavePath, debouncedSaveOperation.cutSegments);
        await saveLlcProject({ savePath: debouncedSaveOperation.projectFileSavePath, mediaFilePath: debouncedSaveOperation.filePath, cutSegments: debouncedSaveOperation.cutSegments });
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
