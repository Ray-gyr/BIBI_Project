import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_REALM = "Slate Recruiter Assistant";
const DEFAULT_USERNAME = "slate";
const MIN_PASSWORD_LENGTH = 16;

export function proxy(request: NextRequest) {
  const requiredPassword = process.env.BIBI_APP_PASSWORD;

  // If no password is configured, default to public access
  if (!requiredPassword) {
    return NextResponse.next();
  }

  // If a password is provided but it's too weak, reject access for security
  if (process.env.NODE_ENV === "production" && requiredPassword.length < MIN_PASSWORD_LENGTH) {
    return serviceUnavailable();
  }

  const credentials = parseBasicAuth(request.headers.get("authorization"));
  const requiredUsername = process.env.BIBI_APP_USERNAME || DEFAULT_USERNAME;

  if (
    !credentials ||
    !secureCompare(credentials.username, requiredUsername) ||
    !secureCompare(credentials.password, requiredPassword)
  ) {
    return new Response("Authentication required.", {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "WWW-Authenticate": `Basic realm="${AUTH_REALM}", charset="UTF-8"`,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

function parseBasicAuth(header: string | null): { username: string; password: string } | null {
  const match = header?.match(/^Basic\s+(.+)$/i);

  if (!match) {
    return null;
  }

  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function serviceUnavailable() {
  return new Response("Application access is not configured.", {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function secureCompare(actual: string, expected: string): boolean {
  const actualDigest = createHash("sha256").update(actual).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();

  return timingSafeEqual(actualDigest, expectedDigest);
}
