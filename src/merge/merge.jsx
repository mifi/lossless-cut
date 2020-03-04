import React from 'react';
import swal from 'sweetalert2';

import withReactContent from 'sweetalert2-react-content';

import SortableFiles from './SortableFiles';


import { errorToast } from '../util';

const MySwal = withReactContent(swal);

export async function showMergeDialog(paths, onMergeClick) {
  if (!paths) return;
  if (paths.length < 2) {
    errorToast('More than one file must be selected');
    return;
  }

  let swalElem;
  let outPaths = paths;
  let allStreams = false;
  const { dismiss } = await MySwal.fire({
    width: '90%',
    showCancelButton: true,
    confirmButtonText: 'Merge!',
    onBeforeOpen: (el) => { swalElem = el; },
    html: (<SortableFiles
      items={outPaths}
      onChange={(val) => { outPaths = val; }}
      onAllStreamsChange={(val) => { allStreams = val; }}
      helperContainer={() => swalElem}
    />),
  });

  if (!dismiss) {
    onMergeClick({ paths: outPaths, allStreams });
  }
}

export async function showOpenAndMergeDialog({ dialog, defaultPath, onMergeClick }) {
  const title = 'Please select files to be merged';
  const message = 'Please select files to be merged. The files need to be of the exact same format and codecs';
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title,
    defaultPath,
    properties: ['openFile', 'multiSelections'],
    message,
  });
  if (canceled) return;
  showMergeDialog(filePaths, onMergeClick);
}
