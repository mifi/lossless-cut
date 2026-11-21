import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDebounce } from 'use-debounce';
import isEqual from 'lodash/isEqual';

import isDev from '../isDev';
import { saveLlcProject } from '../edlStore';
import { mapSaveableSegments } from '../segments';
import { getSuffixedOutPath } from '../util';
import type { StateSegment } from '../types';
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

  // eslint-disable-next-line @eslint-react/naming-convention-ref-name -- TODO fix (new rule in @mifi/lint-config)
  const lastSaveOperation = useRef<typeof debouncedSaveOperation>(undefined);

  const save = useCallback(async (saveOperation: typeof debouncedSaveOperation) => {
    try {
      if (!autoSaveProjectFile
        || saveOperation?.filePath == null
        // Don't create llc file if no segments yet
        || saveOperation.cutSegments.length === 0
        // or if initial segment (and not deselected): https://github.com/mifi/lossless-cut/issues/2745#issuecomment-3979480707
        || (saveOperation.cutSegments[0]?.initial && saveOperation.cutSegments[0].selected)
      ) {
        return;
      }

      if (lastSaveOperation.current && lastSaveOperation.current.projectFileSavePath === saveOperation.projectFileSavePath && isEqual(mapSaveableSegments(lastSaveOperation.current.cutSegments), mapSaveableSegments(saveOperation.cutSegments))) {
        console.log('Segments unchanged, skipping save');
        return;
      }

      console.log('Saving project file', saveOperation.projectFileSavePath, saveOperation.cutSegments);
      await saveLlcProject({ savePath: saveOperation.projectFileSavePath, mediaFilePath: saveOperation.filePath, cutSegments: saveOperation.cutSegments });
      lastSaveOperation.current = saveOperation;
    } catch (err) {
      errorToast(i18n.t('Unable to save project file'));
      console.error('Failed to save project file', err);
    }
  }, [autoSaveProjectFile]);

  useEffect(() => {
    save(debouncedSaveOperation);
  }, [debouncedSaveOperation, save]);

  // When the file is closed or another file is opened (e.g. "next file" in the batch list), the project path changes
  // (and the segments are reset in the same render). The debounced save of the previous file's latest segments would
  // then be dropped, so save them right away instead.
  // eslint-disable-next-line @eslint-react/naming-convention-ref-name -- TODO fix (new rule in @mifi/lint-config)
  const previousSaveOperation = useRef<typeof currentSaveOperation>(undefined);
  useEffect(() => {
    const previous = previousSaveOperation.current;
    previousSaveOperation.current = currentSaveOperation;
    if (previous != null && previous.projectFileSavePath !== currentSaveOperation?.projectFileSavePath) save(previous);
  }, [currentSaveOperation, save]);

  return {
    getEdlFilePath,
    projectFileSavePath,
    getProjectFileSavePath,
  };
};
