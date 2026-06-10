import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function parseJwt(token: string) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get("sb-access-token")?.value;
  const { pathname } = request.nextUrl;

  let approved = false;
  let isAdmin = false;

  if (token) {
    const payload = parseJwt(token);
    approved = payload?.app_metadata?.approved === true;
    isAdmin = payload?.app_metadata?.is_admin === true;
  }

  // Protected paths (require authentication and approval)
  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/agents") ||
    pathname.startsWith("/benchmarks") ||
    pathname.startsWith("/playground") ||
    pathname === "/"; // Redirect root path to dashboard

  // Admin paths (require admin privileges)
  const isAdminRoute = pathname.startsWith("/admin");

  // Public authentication paths (login/signup)
  const isAuthRoute =
    pathname.startsWith("/auth/login") ||
    pathname.startsWith("/auth/signup");

  // Pending path (for authenticated but unapproved users)
  const isPendingRoute = pathname === "/auth/pending";

  // Case 1: Unauthenticated user trying to access protected, admin, or pending routes
  if ((isProtectedRoute || isAdminRoute || isPendingRoute) && !token) {
    const loginUrl = new URL("/auth/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Case 2: Authenticated user
  if (token) {
    // If user is already approved and tries to go to login, signup, or pending, redirect to dashboard
    if (approved) {
      if (isAuthRoute || isPendingRoute) {
        const dashboardUrl = new URL("/dashboard", request.url);
        return NextResponse.redirect(dashboardUrl);
      }
    } else {
      // User is not approved
      // If they try to access protected, admin, or auth routes (login/signup), redirect to pending page
      if (isProtectedRoute || isAdminRoute || isAuthRoute) {
        const pendingUrl = new URL("/auth/pending", request.url);
        return NextResponse.redirect(pendingUrl);
      }
    }

    // If it's an admin route, verify the user is an admin
    if (isAdminRoute && !isAdmin) {
      const dashboardUrl = new URL("/dashboard", request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/agents/:path*",
    "/benchmarks/:path*",
    "/playground/:path*",
    "/admin/:path*",
    "/auth/login",
    "/auth/signup",
    "/auth/pending",
  ],
};
