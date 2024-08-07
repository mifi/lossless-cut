import SwalRaw from 'sweetalert2/dist/sweetalert2.js';
import type { SweetAlertOptions } from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';


const { systemPreferences } = window.require('@electron/remote');

const animationSettings = systemPreferences.getAnimationSettings();

let commonSwalOptions: SweetAlertOptions = {
  target: '#swal2-container-wrapper',
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

export const swalToastOptions: SweetAlertOptions = {
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
};

export const toast = Swal.mixin(swalToastOptions);

export const errorToast = (text: string) => toast.fire({
  icon: 'error',
  text,
});

export const ReactSwal = withReactContent(Swal);
