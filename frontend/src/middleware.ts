import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "@/modules/auth/services/auth";

const publicRoutes = ["/", "/events", "/events/(.*)", "/auth/login", "/auth/register", "/api/(.*)"];
const authRoutes = ["/auth/login", "/auth/register"];

function isPublic(pathname: string): boolean {
  return publicRoutes.some((route) => {
    if (route.endsWith("/(.*)")) {
      const base = route.slice(0, -5);
      return pathname.startsWith(base);
    }
    return pathname === route;
  });
}

export function middleware(request: NextRequest) {
  const token = getToken();
  const { pathname } = request.nextUrl;

  const isPublicRoute = isPublic(pathname);
  const isAuthRoute = authRoutes.includes(pathname);

  // Redirect to login if not authenticated and route is not public
  if (!token && !isPublicRoute) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Redirect to home if authenticated and on auth route (login/register)
  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};