import type { StateSegment } from './types';

export type ProjectFileSaveAction = 'save' | 'delete-stale' | 'skip';

// Decides what the project file auto-save should do when the segments change.
//
// When the user deletes all segments after a project file was saved, the stale
// project file must be removed, otherwise reopening the file would resurrect the
// deleted segments: https://github.com/mifi/lossless-cut/issues/1294
// (But a project file must still not be created if there were no segments yet.)
export function getProjectFileSaveAction({ lastSavedProjectFileSavePath, projectFileSavePath, cutSegments }: {
  lastSavedProjectFileSavePath: string | undefined,
  projectFileSavePath: string,
  cutSegments: StateSegment[],
}): ProjectFileSaveAction {
  if (cutSegments.length === 0) {
    return lastSavedProjectFileSavePath === projectFileSavePath ? 'delete-stale' : 'skip';
  }
  // Don't save if there is only the initial segment (and it is not deselected):
  // https://github.com/mifi/lossless-cut/issues/2745#issuecomment-3979480707
  if (cutSegments[0]?.initial && cutSegments[0].selected) return 'skip';
  return 'save';
}
