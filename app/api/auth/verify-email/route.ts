import { NextResponse } from "next/server";
import { SignJWT } from "jose";

import { db } from "@/prisma/client";
import { env } from "@/lib/env";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get("token")?.trim();
        if (!token) {
            return NextResponse.json({ error: "Missing token" }, { status: 400 });
        }

        const vt = await db.verificationToken.findFirst({ where: { token } });
        if (!vt || vt.expires < new Date()) {
            return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
        }

        const user = await db.user.update({
            where: { email: vt.identifier },
            data: { emailVerified: new Date() },
            select: {
                id: true,
                username: true,
                role: true,
                email: true,
                name: true,
                image: true,
            },
        });

        await db.verificationToken.deleteMany({ where: { identifier: vt.identifier } });

        const displayName = user.username ?? user.name ?? "there";
        const callbackUrl = `/user-onboarding?username=${encodeURIComponent(displayName)}`;

        const secret = new TextEncoder().encode(env.NEXTAUTH_SECRET);
        const tokenPayload = {
            email: user.email,
        };
        const onboardingToken = await new SignJWT(tokenPayload)
            .setProtectedHeader({ alg: "HS256", typ: "JWT" })
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(secret);

        const res = NextResponse.json({ ok: true, callbackUrl });
        res.cookies.set("onboarding_token", onboardingToken, {
            httpOnly: true,
            sameSite: "lax",
            secure: env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60, // 1 hour
        });

        return res;
    } catch (error) {
        console.error("[verify-email]", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
