import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

/**
 * GET: return the viewer's search-profile data
 *  - role
 *  - about (User.bio)
 *  - goals (TraineeProfile.goals)
 *  - services + hourlyRate (TrainerProfile)
 *  - gymFee (GymProfile.fee)
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const me = await db.user.findUnique({
        where: { email: session.user.email },
        select: {
            id: true,
            role: true,
            bio: true,
            traineeProfile: { select: { goals: true } },
            trainerProfile: { select: { services: true, hourlyRate: true } },
            gymProfile: { select: { fee: true } },
        },
    });

    if (!me) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
        role: me.role,
        about: me.bio ?? "",
        goals: me.traineeProfile?.goals ?? [],
        services: me.trainerProfile?.services ?? [],
        hourlyRate: me.trainerProfile?.hourlyRate ?? null,
        gymFee: me.gymProfile?.fee ?? null,
    });
}

/**
 * PATCH: update the viewer's search-profile data
 * Body:
 *  {
 *    about?: string,
 *    goals?: string[],          // if role=TRAINEE
 *    services?: string[],       // if role=TRAINER
 *    hourlyRate?: number | null // if role=TRAINER
 *    gymFee?: number | null     // if role=GYM
 *  }
 */
export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const me = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, role: true },
    });

    if (!me) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({} as any));
    const about: string | undefined =
        typeof body?.about === "string" ? body.about : undefined;

    const goals: string[] | undefined = Array.isArray(body?.goals)
        ? body.goals
            .map((s: any) => (typeof s === "string" ? s.trim() : ""))
            .filter(Boolean)
        : undefined;

    const services: string[] | undefined = Array.isArray(body?.services)
        ? body.services
            .map((s: any) => (typeof s === "string" ? s.trim() : ""))
            .filter(Boolean)
        : undefined;

    const hourlyRateRaw = body?.hourlyRate;
    const hourlyRate: number | null | undefined =
        hourlyRateRaw === null
            ? null
            : typeof hourlyRateRaw === "number"
                ? Number.isFinite(hourlyRateRaw)
                    ? hourlyRateRaw
                    : undefined
                : undefined;

    const gymFeeRaw = body?.gymFee;
    const gymFee: number | null | undefined =
        gymFeeRaw === null
            ? null
            : typeof gymFeeRaw === "number"
                ? Number.isFinite(gymFeeRaw)
                    ? gymFeeRaw
                    : undefined
                : undefined;

    // Build updates
    const userData: any = {};
    if (about !== undefined) userData.bio = about;

    // Apply role-specific updates
    if (me.role === "TRAINEE") {
        if (goals !== undefined) {
            // upsert trainee profile
            await db.traineeProfile.upsert({
                where: { userId: me.id },
                update: { goals },
                create: { userId: me.id, goals },
            });
        }
    } else if (me.role === "TRAINER") {
        const updateData: any = {};
        if (services !== undefined) updateData.services = services;
        if (hourlyRate !== undefined) updateData.hourlyRate = hourlyRate;

        if (Object.keys(updateData).length) {
            await db.trainerProfile.upsert({
                where: { userId: me.id },
                update: updateData,
                create: { userId: me.id, services: updateData.services ?? [], hourlyRate: updateData.hourlyRate ?? null },
            });
        }
    } else if (me.role === "GYM") {
        if (gymFee !== undefined) {
            await db.gymProfile.upsert({
                where: { userId: me.id },
                update: { fee: gymFee },
                create: {
                    userId: me.id,
                    name: "Gym", // required field in your schema; adjust if you capture an actual name elsewhere
                    address: "",
                    phone: "",
                    website: "",
                    fee: gymFee ?? 0,
                    amenities: [],
                },
            });
        }
    }

    if (Object.keys(userData).length) {
        await db.user.update({ where: { id: me.id }, data: userData });
    }

    return NextResponse.json({ ok: true });
}
