export class DirectoryAccessDeclinedError extends Error {
  constructor() {
    super();
    this.name = 'DirectoryAccessDeclinedError';
  }
}

export class UnsupportedFileError extends Error {
  constructor(message: string, opts?: ErrorOptions) {
    super(message, opts);
    this.name = 'UnsupportedFileError';
  }
}

/** An MP4/MOV whose recording was interrupted before its index (moov) was written: not unsupported, but damaged */
export class InterruptedRecordingError extends UnsupportedFileError {
  constructor(message: string, opts?: ErrorOptions) {
    super(message, opts);
    this.name = 'InterruptedRecordingError';
  }
}

export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}
