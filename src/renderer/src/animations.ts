import mitt from 'mitt';


export const mySpring = { type: 'spring' as const, damping: 50, stiffness: 700 };

export const emitter = mitt<{
  reducedMotion: boolean
}>();
