// eslint-disable-next-line import/prefer-default-export
export const mySpring = { type: 'spring', damping: 50, stiffness: 700 };

let prefersReducedMotionValue = false;

export function setPrefersReducedMotion(v: boolean) {
  prefersReducedMotionValue = v;
}

export const prefersReducedMotion = () => prefersReducedMotionValue;
