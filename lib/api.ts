import { NextResponse } from "next/server";

export type ApiMeta = Record<string, string | number | boolean | null>;

export type ApiSuccessResponse<T> = {
  data: T;
  meta?: ApiMeta;
};

export type ApiErrorResponse = {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
};

export class Api {
  /**
   * 200 OK
   * Standard success response
   */
  static ok<T>(data: T, meta?: ApiMeta) {
    return NextResponse.json({ data, meta } as ApiSuccessResponse<T>, { status: 200 });
  }

  /**
   * 201 Created
   * Successfully created a new resource
   */
  static created<T>(data: T) {
    return NextResponse.json({ data } as ApiSuccessResponse<T>, { status: 201 });
  }

  /**
   * 204 No Content
   * Successful operation with no content to return (e.g., idempotent delete on non-existent resource)
   */
  static noContent() {
    return new NextResponse(null, { status: 204 });
  }

  /**
   * 400 Bad Request
   * Client provided invalid data
   */
  static badRequest(message: string, details?: unknown) {
    return NextResponse.json(
      { error: { message, code: "BAD_REQUEST", details } } as ApiErrorResponse,
      { status: 400 }
    );
  }

  /**
   * 401 Unauthorized
   * Authentication required
   */
  static unauthorized(message = "Unauthorized") {
    return NextResponse.json(
      { error: { message, code: "UNAUTHORIZED" } } as ApiErrorResponse,
      { status: 401 }
    );
  }

  /**
   * 403 Forbidden
   * Authenticated but lacks permissions
   */
  static forbidden(message = "Forbidden") {
    return NextResponse.json(
      { error: { message, code: "FORBIDDEN" } } as ApiErrorResponse,
      { status: 403 }
    );
  }

  /**
   * 404 Not Found
   * Resource does not exist
   */
  static notFound(message = "Resource not found") {
    return NextResponse.json(
      { error: { message, code: "NOT_FOUND" } } as ApiErrorResponse,
      { status: 404 }
    );
  }

  /**
   * 409 Conflict
   * Resource state conflict (e.g., unique constraint violation)
   */
  static conflict(message: string, details?: unknown) {
    return NextResponse.json(
      { error: { message, code: "CONFLICT", details } } as ApiErrorResponse,
      { status: 409 }
    );
  }

  /**
   * 429 Too Many Requests
   * Client exceeded a rate limit; include Retry-After so well-behaved
   * clients back off correctly.
   */
  static tooManyRequests(message = "Too many requests", retryAfterSeconds?: number) {
    const response = NextResponse.json(
      { error: { message, code: "TOO_MANY_REQUESTS" } } as ApiErrorResponse,
      { status: 429 }
    );
    if (retryAfterSeconds !== undefined) {
      response.headers.set("Retry-After", String(Math.max(0, Math.ceil(retryAfterSeconds))));
    }
    return response;
  }

  /**
   * 503 Service Unavailable
   * Required dependency is down or intentionally not configured.
   */
  static serviceUnavailable(message = "Service temporarily unavailable") {
    return NextResponse.json(
      { error: { message, code: "SERVICE_UNAVAILABLE" } } as ApiErrorResponse,
      { status: 503 }
    );
  }

  /**
   * 500 Internal Server Error
   * Unexpected server error. Never leak stack traces to the client.
   */
  static internalError(message = "Internal server error") {
    return NextResponse.json(
      { error: { message, code: "INTERNAL_ERROR" } } as ApiErrorResponse,
      { status: 500 }
    );
  }
}
