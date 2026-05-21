/**
 * Typed errors raised by the SDK.
 * JSON-RPC error codes from iwant.fyi demand-side protocol v1.0 §11.
 */

export class IwantError extends Error {
  public code: number;
  public data?: unknown;

  constructor(message: string, code = -32603, data?: unknown) {
    super(message);
    this.name = "IwantError";
    this.code = code;
    this.data = data;
  }
}

export class UnauthorizedError extends IwantError {
  constructor(message = "Unauthorized: valid API key required") {
    super(message, -32000);
    this.name = "UnauthorizedError";
  }
}

export class RateLimitedError extends IwantError {
  constructor(message = "Rate limit exceeded") {
    super(message, -32001);
    this.name = "RateLimitedError";
  }
}

export class ValidationError extends IwantError {
  constructor(message: string, data?: unknown) {
    super(message, -32602, data);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends IwantError {
  constructor(message = "Resource not found") {
    super(message, -32602);
    this.name = "NotFoundError";
  }
}

export function errorFromCode(code: number, message: string, data?: unknown): IwantError {
  switch (code) {
    case -32000:
      return new UnauthorizedError(message);
    case -32001:
      return new RateLimitedError(message);
    case -32602:
      return new ValidationError(message, data);
    default:
      return new IwantError(message, code, data);
  }
}
