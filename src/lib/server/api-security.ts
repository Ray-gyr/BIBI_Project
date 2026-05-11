import { NextResponse } from "next/server";
import { type ZodError, type ZodType } from "zod";

const DEFAULT_MAX_JSON_BODY_BYTES = 1_000_000;
const MAX_VALIDATION_ISSUES = 10;

type JsonValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export async function validateJsonRequest<T>(
  request: Request,
  schema: ZodType<T>,
  options: { maxBytes?: number } = {},
): Promise<JsonValidationResult<T>> {
  const originResponse = validateBrowserOrigin(request);

  if (originResponse) {
    return { ok: false, response: originResponse };
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().startsWith("application/json")) {
    return {
      ok: false,
      response: errorResponse("Content-Type must be application/json.", 415),
    };
  }

  let body: unknown;

  try {
    const rawBody = await readRequestBody(
      request,
      options.maxBytes ?? DEFAULT_MAX_JSON_BODY_BYTES,
    );

    if (!rawBody.trim()) {
      return { ok: false, response: errorResponse("Request body is required.", 400) };
    }

    body = JSON.parse(rawBody);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return { ok: false, response: errorResponse(error.message, 413) };
    }

    return { ok: false, response: errorResponse("Request body must be valid JSON.", 400) };
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Invalid request payload.",
          issues: formatValidationIssues(parsed.error),
        },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

export function serviceUnavailableResponse() {
  return errorResponse("The AI service is not configured.", 503);
}

export function internalErrorResponse() {
  return errorResponse("The AI service could not complete the request.", 502);
}

export function logRouteError(route: string, error: unknown) {
  const safeDetails =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
        }
      : { message: String(error) };

  console.error(`${route} failed`, safeDetails);
}

function validateBrowserOrigin(request: Request): NextResponse | null {
  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite === "cross-site") {
    return errorResponse("Cross-site requests are not allowed.", 403);
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    return null;
  }

  try {
    const requestUrl = new URL(request.url);
    const host = getForwardedHeader(request, "x-forwarded-host") ?? request.headers.get("host");
    const protocol =
      getForwardedHeader(request, "x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");

    if (!host) {
      return errorResponse("Request host is required.", 400);
    }

    const expectedOrigin = `${protocol}://${host}`;

    if (new URL(origin).origin !== expectedOrigin) {
      return errorResponse("Cross-origin requests are not allowed.", 403);
    }
  } catch {
    return errorResponse("Invalid request origin.", 400);
  }

  return null;
}

function getForwardedHeader(request: Request, header: string): string | null {
  return request.headers.get(header)?.split(",")[0]?.trim() || null;
}

async function readRequestBody(request: Request, maxBytes: number): Promise<string> {
  const declaredLength = request.headers.get("content-length");

  if (declaredLength) {
    const parsedLength = Number.parseInt(declaredLength, 10);

    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw new PayloadTooLargeError(maxBytes);
    }
  }

  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let body = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    receivedBytes += value.byteLength;

    if (receivedBytes > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError(maxBytes);
    }

    body += decoder.decode(value, { stream: true });
  }

  body += decoder.decode();

  return body;
}

function formatValidationIssues(error: ZodError) {
  return error.issues.slice(0, MAX_VALIDATION_ISSUES).map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

class PayloadTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Request body exceeds the ${formatBytes(maxBytes)} limit.`);
    this.name = "PayloadTooLargeError";
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.floor(bytes / (1024 * 1024))} MB`;
  }

  return `${Math.floor(bytes / 1024)} KB`;
}
