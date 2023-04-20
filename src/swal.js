import SwalRaw from 'sweetalert2';

import { primaryColor } from './colors';


const { systemPreferences } = window.require('@electron/remote');

const animationSettings = systemPreferences.getAnimationSettings();

let commonSwalOptions = {
  confirmButtonColor: primaryColor,
};

if (animationSettings.prefersReducedMotion) {
  commonSwalOptions = {
    ...commonSwalOptions,
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
  };
}

const Swal = SwalRaw.mixin({
  ...commonSwalOptions,
});

export default Swal;

export const swalToastOptions = {
  ...commonSwalOptions,
  toast: true,
  position: 'top',
  showConfirmButton: false,
  showCloseButton: true,
  timer: 5000,
  timerProgressBar: true,
  didOpen: (self) => {
    self.addEventListener('mouseenter', Swal.stopTimer);
    self.addEventListener('mouseleave', Swal.resumeTimer);
  },
};

export const toast = Swal.mixin(swalToastOptions);

export const errorToast = (text) => toast.fire({
  icon: 'error',
  text,
});
