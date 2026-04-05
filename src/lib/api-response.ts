import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/**
 * Standard API error codes. Use these instead of ad-hoc strings
 * so clients can switch on them programmatically.
 */
export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "BAD_REQUEST"
  | "CONFLICT";

interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

// ── Error responses ─────────────────────────────────────────────

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: unknown,
) {
  const body: ApiError = { code, message };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}

export function unauthorized(message = "Authentication required") {
  return apiError("UNAUTHORIZED", message, 401);
}

export function forbidden(message = "Access denied") {
  return apiError("FORBIDDEN", message, 403);
}

export function notFound(resource = "Resource") {
  return apiError("NOT_FOUND", `${resource} not found`, 404);
}

export function validationError(error: ZodError) {
  return apiError(
    "VALIDATION_ERROR",
    "Request validation failed",
    400,
    error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  );
}

export function badRequest(message: string) {
  return apiError("BAD_REQUEST", message, 400);
}

export function conflict(message: string) {
  return apiError("CONFLICT", message, 409);
}

export function rateLimited(retryAfterMs: number) {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  const res = apiError(
    "RATE_LIMITED",
    `Too many requests. Retry after ${retryAfterSec}s`,
    429,
  );
  res.headers.set("Retry-After", String(retryAfterSec));
  return res;
}

export function internalError(message = "Internal server error") {
  return apiError("INTERNAL_ERROR", message, 500);
}

// ── Success responses ───────────────────────────────────────────

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiCreated<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}
