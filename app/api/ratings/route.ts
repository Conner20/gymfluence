// app/api/ratings/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

function extractUserId(session: any): string | null {
    return (
        session?.user?.id ??
        session?.user?.sub ??
        session?.sub ??
        null
    );
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let userId = extractUserId(session);

        if (!userId && session?.user?.email) {
            const user = await db.user.findUnique({
                where: { email: session.user.email! },
                select: { id: true },
            });
            userId = user?.id ?? null;
        }

        if (!userId) {
            return NextResponse.json({ error: "Cannot resolve current user id" }, { status: 401 });
        }

        const body = await req.json();
        const { trainerId, gymId, stars, comment } = body ?? {};

        if (typeof stars !== "number" || !Number.isFinite(stars) || stars < 1 || stars > 5) {
            return NextResponse.json({ error: "stars must be an integer from 1 to 5" }, { status: 400 });
        }

        const targetCount = Number(Boolean(trainerId)) + Number(Boolean(gymId));
        if (targetCount !== 1) {
            return NextResponse.json({ error: "Provide exactly one of trainerId or gymId" }, { status: 400 });
        }

        const me = await db.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });

        if (!me) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Role restrictions
        if (me.role === "GYM") {
            return NextResponse.json({ error: "Gyms cannot author ratings" }, { status: 403 });
        }
        if (me.role === "TRAINER" && trainerId) {
            return NextResponse.json({ error: "Trainers can only rate gyms" }, { status: 403 });
        }

        if (trainerId) {
            const trainer = await db.trainerProfile.findUnique({
                where: { id: trainerId },
                select: { userId: true },
            });
            if (!trainer) return NextResponse.json({ error: "Trainer not found" }, { status: 404 });
            if (trainer.userId === userId) {
                return NextResponse.json({ error: "You cannot rate yourself" }, { status: 403 });
            }
        }

        if (gymId) {
            const gym = await db.gymProfile.findUnique({
                where: { id: gymId },
                select: { userId: true },
            });
            if (!gym) return NextResponse.json({ error: "Gym not found" }, { status: 404 });
            if (gym.userId === userId) {
                return NextResponse.json({ error: "You cannot rate your own gym" }, { status: 403 });
            }
        }

        if (trainerId) {
            const existing = await db.rating.findUnique({
                where: { raterId_trainerId: { raterId: userId, trainerId } },
                select: { id: true },
            });
            if (existing) {
                return NextResponse.json({ error: "You already rated this trainer" }, { status: 409 });
            }
        } else if (gymId) {
            const existing = await db.rating.findUnique({
                where: { raterId_gymId: { raterId: userId, gymId } },
                select: { id: true },
            });
            if (existing) {
                return NextResponse.json({ error: "You already rated this gym" }, { status: 409 });
            }
        }

        const created = await db.rating.create({
            data: {
                raterId: userId,
                trainerId: trainerId ?? null,
                gymId: gymId ?? null,
                stars: Math.round(stars),
                comment: comment ?? null,
                status: "PENDING",
            },
            select: {
                id: true,
                status: true,
                stars: true,
                comment: true,
                trainerId: true,
                gymId: true,
                createdAt: true,
            },
        });

        return NextResponse.json(created, { status: 201 });
    } catch (err: any) {
        console.error("POST /api/ratings error:", err);
        return NextResponse.json({ error: "Failed to create rating" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        let userId = extractUserId(session);
        if (!userId && session?.user?.email) {
            const user = await db.user.findUnique({
                where: { email: session.user.email! },
                select: { id: true },
            });
            userId = user?.id ?? null;
        }
        if (!userId) return NextResponse.json({ error: "Cannot resolve current user id" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const authored = searchParams.get("authored");
        const pendingFor = searchParams.get("pendingFor"); // "trainer" | "gym"

        if (authored) {
            const ratings = await db.rating.findMany({
                where: { raterId: userId },
                orderBy: { createdAt: "desc" },
            });
            return NextResponse.json(ratings);
        }

        if (pendingFor === "trainer") {
            const myTrainer = await db.trainerProfile.findUnique({
                where: { userId },
                select: { id: true },
            });
            if (!myTrainer) return NextResponse.json([], { status: 200 });

            const ratings = await db.rating.findMany({
                where: { trainerId: myTrainer.id, status: "PENDING" },
                orderBy: { createdAt: "desc" },
            });
            return NextResponse.json(ratings);
        }

        if (pendingFor === "gym") {
            const myGym = await db.gymProfile.findUnique({
                where: { userId },
                select: { id: true },
            });
            if (!myGym) return NextResponse.json([], { status: 200 });

            const ratings = await db.rating.findMany({
                where: { gymId: myGym.id, status: "PENDING" },
                orderBy: { createdAt: "desc" },
            });
            return NextResponse.json(ratings);
        }

        return NextResponse.json({ error: "Unsupported query" }, { status: 400 });
    } catch (err: any) {
        console.error("GET /api/ratings error:", err);
        return NextResponse.json({ error: "Failed to query ratings" }, { status: 500 });
    }
}
