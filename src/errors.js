/**
 * Base class for every error thrown by the wrapper.
 */
class FomoError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "FomoError";
  }
}

/**
 * Thrown when the Fomo API answers with a non-2xx status.
 */
class FomoApiError extends FomoError {
  /**
   * @param {{ status: number, method: string, path: string, body: unknown }} details
   */
  constructor({ status, method, path, body }) {
    const detail =
      (body && typeof body === "object" && (body.error || body.message)) ||
      (typeof body === "string" && body ? "non-JSON response (possibly blocked by Cloudflare)" : null) ||
      "Request failed";

    super(`${method} ${path} failed with ${status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
    this.name = "FomoApiError";
    this.status = status;
    this.method = method;
    this.path = path;
    this.body = body;
  }
}

/**
 * Thrown when no usable access token is available, or a refresh fails.
 */
class FomoAuthError extends FomoError {
  constructor(message, options) {
    super(message, options);
    this.name = "FomoAuthError";
  }
}

module.exports = {
  FomoError,
  FomoApiError,
  FomoAuthError,
};
