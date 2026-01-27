// app/api/user/update-role/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env";

async function getIdentifierFromOnboardingCookie() {
    const cookieStore = await cookies();
    const token = cookieStore.get("onboarding_token")?.value;
    if (!token) return null;
    try {
        const secret = new TextEncoder().encode(env.NEXTAUTH_SECRET);
        const { payload } = await jwtVerify(token, secret);
        if (typeof payload?.email === "string" && payload.email.length > 0) {
            return payload.email;
        }
        return null;
    } catch (err) {
        console.error("onboarding token verification failed:", err);
        return null;
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    let identifier = session?.user?.email ?? null;

    if (!identifier) {
        identifier = await getIdentifierFromOnboardingCookie();
    }

    if (!identifier) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        let { role, selections = [], gymForm } = body;

        identifier = identifier.toLowerCase();

        // normalize and validate role
        if (typeof role === "string") role = role.toUpperCase();
        if (!["TRAINEE", "TRAINER", "GYM"].includes(role)) {
            return NextResponse.json({ message: "Invalid role" }, { status: 400 });
        }

        // find current user (by email from session)
        const current = await db.user.findFirst({
            where: { email: { equals: identifier, mode: "insensitive" } },
            select: { id: true },
        });
        if (!current) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        const data: any = { role };

        if (role === "TRAINEE") {
            if (!Array.isArray(selections)) selections = [];
            data.traineeProfile = {
                upsert: {
                    update: { goals: selections },
                    // ❌ do NOT include userId in nested create
                    create: { goals: selections },
                },
            };
        }

        if (role === "TRAINER") {
            if (!Array.isArray(selections)) selections = [];
            data.trainerProfile = {
                upsert: {
                    update: { services: selections },
                    // ❌ do NOT include userId in nested create
                    create: { services: selections },
                },
            };
        }

        if (role === "GYM") {
            if (!gymForm) {
                return NextResponse.json({ message: "Missing gym form" }, { status: 400 });
            }

            // Ensure fee is a number (schema uses Float)
            const feeNum = Number(gymForm.fee);
            if (Number.isNaN(feeNum)) {
                return NextResponse.json({ message: "Fee must be a number" }, { status: 400 });
            }

            data.gymProfile = {
                upsert: {
                    update: {
                        name: gymForm.name,
                        address: gymForm.address,
                        phone: gymForm.phone,
                        website: gymForm.website,
                        fee: feeNum,
                    },
                    create: {
                        name: gymForm.name,
                        address: gymForm.address,
                        phone: gymForm.phone,
                        website: gymForm.website,
                        fee: feeNum,
                    },
                },
            };
        }

        const user = await db.user.update({
            where: { id: current.id },
            data,
            include: {
                traineeProfile: true,
                trainerProfile: true,
                gymProfile: true,
            },
        });

        const res = NextResponse.json({ user, message: "User updated" });
        res.cookies.delete("onboarding_token");
        return res;
    } catch (err: any) {
        console.error("update-role error:", err);
        // surface a useful message if possible
        return NextResponse.json(
            { message: err?.message || "Update failed" },
            { status: 500 }
        );
    }
}
