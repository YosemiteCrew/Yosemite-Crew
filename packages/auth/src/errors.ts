// Provider-neutral auth errors.

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class AuthRequiredError extends AuthError {
  constructor(message = 'Authentication required') {
    super(message, 401);
    this.name = 'AuthRequiredError';
  }
}

// The access token is expired (or otherwise needs the SDK to run its refresh
// flow). Must surface as a plain 401 so the web/mobile SDKs trigger their
// automatic session refresh and retry.
export class AuthSessionExpiredError extends AuthError {
  constructor(message = 'try refresh token') {
    super(message, 401);
    this.name = 'AuthSessionExpiredError';
  }
}

// The session is valid but belongs to a different product profile than the
// route requires (e.g. a pet-parent mobile session calling a staff route).
export class AuthProfileMismatchError extends AuthError {
  constructor(message = 'Session not valid for this resource') {
    super(message, 403);
    this.name = 'AuthProfileMismatchError';
  }
}

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthConfigError';
  }
}
