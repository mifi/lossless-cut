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

export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}
