import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = [
    "/",
    "/log-in",
    "/sign-up",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
    "/user-onboarding",
];

const startsWithAny = (pathname: string, prefixes: string[]) =>
    prefixes.some((prefix) => pathname.startsWith(prefix));

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Always allow Next.js internals, static assets, and APIs
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/api") ||
        pathname.startsWith("/static") ||
        pathname.startsWith("/assets") ||
        pathname.startsWith("/favicon.ico") ||
        /\.[^/]+$/.test(pathname)
    ) {
        return NextResponse.next();
    }

    const isPublic =
        PUBLIC_PATHS.includes(pathname) ||
        startsWithAny(pathname, ["/verify-email", "/reset-password"]);

    if (isPublic) {
        return NextResponse.next();
    }

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
        const redirectUrl = new URL("/", req.url);
        return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
