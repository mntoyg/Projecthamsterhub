// Every module boundary throws one of these. A node:sqlite or express error never
// escapes the module that produced it.

export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 500, code = 'INTERNAL', options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
  }
}

/** Thrown by store.ts and db.ts. The underlying driver message stays in `cause`, for the log only. */
export class StorageError extends AppError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, 500, 'STORAGE', options);
  }
}

/** Thrown when a request is well-formed JSON but fails the contract's field rules. */
export class ValidationError extends AppError {
  readonly errors: string[];

  constructor(errors: string[]) {
    super('request failed validation', 400, 'VALIDATION');
    this.errors = errors;
  }
}
