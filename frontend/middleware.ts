import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("sb-access-token")?.value;
  const { pathname } = request.nextUrl;

  // Protected paths
  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/agents") ||
    pathname.startsWith("/benchmarks") ||
    pathname === "/"; // Redirect root path to dashboard

  // Public authentication paths
  const isAuthRoute =
    pathname.startsWith("/auth/login") ||
    pathname.startsWith("/auth/signup");

  if (isProtectedRoute && !token) {
    // Redirect to login page if unauthenticated
    const loginUrl = new URL("/auth/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && token) {
    // Redirect to dashboard page if already authenticated
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // Allow navigation for public page paths or assets
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/agents/:path*",
    "/benchmarks/:path*",
    "/auth/login",
    "/auth/signup",
  ],
};
