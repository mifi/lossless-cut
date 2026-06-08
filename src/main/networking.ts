let disableNetworking: boolean;

export const hasDisabledNetworking = () => !!disableNetworking;

export function throwIfDisabledNetworking() {
  if (hasDisabledNetworking()) {
    throw new Error('Networking is disabled');
  }
}

export function setDisableNetworking(value: boolean) {
  disableNetworking = value;
}
