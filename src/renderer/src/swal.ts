import SwalRaw from 'sweetalert2/dist/sweetalert2.js';
import type { SweetAlertOptions } from 'sweetalert2';
import withReactContent, { ReactSweetAlert, SweetAlert2 } from 'sweetalert2-react-content';

import i18n from './i18n';
import { emitter as animationsEmitter } from './animations';


export const swalContainerWrapperId = 'swal2-container-wrapper';

let Swal: typeof SwalRaw;
let toast: typeof SwalRaw;
let ReactSwal: SweetAlert2 & ReactSweetAlert;

function initSwal(reducedMotion = false) {
  const commonSwalOptions: SweetAlertOptions = {
    target: `#${swalContainerWrapperId}`,
    ...(reducedMotion && {
      showClass: {
        popup: '',
        backdrop: '',
        icon: '',
      },
      hideClass: {
        popup: '',
        backdrop: '',
        icon: '',
      },
    }),
  };

  Swal = SwalRaw.mixin({
    ...commonSwalOptions,
  });

  toast = Swal.mixin({
    ...commonSwalOptions,
    toast: true,
    width: '50vw',
    position: 'top',
    showConfirmButton: false,
    showCloseButton: true,
    timer: 5000,
    timerProgressBar: true,
    didOpen: (self) => {
      self.addEventListener('mouseenter', Swal.stopTimer);
      self.addEventListener('mouseleave', Swal.resumeTimer);
    },
    reverseButtons: true,
  });

  ReactSwal = withReactContent(Swal);
}

animationsEmitter.on('reducedMotion', (reducedMotion) => initSwal(reducedMotion));

initSwal();

export default function getSwal() {
  return {
    Swal,
    ReactSwal,
    toast,
  };
}

export const errorToast = (text: string) => toast.fire({
  icon: 'error',
  text,
});

export const showPlaybackFailedMessage = () => errorToast(i18n.t('Unable to playback this file. Try to convert to supported format from the menu'));
