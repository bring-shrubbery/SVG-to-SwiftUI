// Sec-Fetch-Mode: navigate
// X-Robots-Tag: noindex

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  const response = NextResponse.next();

  // Overwrite the response headers for /_next/static/* routes
  if (request.nextUrl.pathname.startsWith("/_next/static")) {
    if (requestHeaders.get("Sec-Fetch-Mode") === "navigate") {
      response.headers.set("X-Robots-Tag", "noindex");
    }
  }

  response.headers.set("X-Quassum", "https://quassum.com");

  return response;
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: "/((?!api|favicon.ico).*)",
};
