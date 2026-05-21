/**
 * @iwantfyi/sdk -- TypeScript SDK for iwant.fyi, the reference
 * implementation of the iwant.fyi demand-side protocol v1.0.
 *
 * Spec: https://iwant.fyi/protocol/v1
 */

export { IwantClient } from "./client.js";
export type { IwantClientOptions } from "./client.js";
export * from "./types.js";
export {
  IwantError,
  UnauthorizedError,
  RateLimitedError,
  ValidationError,
  NotFoundError,
  errorFromCode,
} from "./errors.js";
