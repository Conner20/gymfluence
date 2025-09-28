// app/api/ratings/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

function extractUserId(session: any): string | null {
    return session?.user?.id ?? session?.user?.sub ?? session?.sub ?? null;
}

// PATCH { action: "APPROVE" | "DECLINE" }
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
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

        const { id } = ctx.params;
        const body = await req.json().catch(() => ({}));
        const action = body?.action as "APPROVE" | "DECLINE";

        if (action !== "APPROVE" && action !== "DECLINE") {
            return NextResponse.json({ error: "action must be APPROVE or DECLINE" }, { status: 400 });
        }

        // Fetch rating (must be pending)
        const rating = await db.rating.findUnique({
            where: { id },
            select: { id: true, status: true, trainerId: true, gymId: true, stars: true },
        });
        if (!rating) return NextResponse.json({ error: "Rating not found" }, { status: 404 });
        if (rating.status !== "PENDING") {
            return NextResponse.json({ error: "Only pending ratings can be modified" }, { status: 409 });
        }

        // Authorization: only the owner of the target profile may act
        if (rating.trainerId) {
            const trainer = await db.trainerProfile.findUnique({
                where: { id: rating.trainerId },
                select: { userId: true },
            });
            if (!trainer) return NextResponse.json({ error: "Trainer not found" }, { status: 404 });
            if (trainer.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        } else if (rating.gymId) {
            const gym = await db.gymProfile.findUnique({
                where: { id: rating.gymId },
                select: { userId: true },
            });
            if (!gym) return NextResponse.json({ error: "Gym not found" }, { status: 404 });
            if (gym.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        } else {
            return NextResponse.json({ error: "Rating has no target" }, { status: 400 });
        }

        // DECLINE: set status only
        if (action === "DECLINE") {
            const declined = await db.rating.update({
                where: { id },
                data: { status: "DECLINED" },
                select: { id: true, status: true },
            });
            return NextResponse.json(declined);
        }

        // APPROVE: mark approved, recompute average for target, increment clients
        const result = await db.$transaction(async (tx) => {
            const approved = await tx.rating.update({
                where: { id },
                data: { status: "APPROVED" },
                select: { trainerId: true, gymId: true },
            });

            if (approved.trainerId) {
                const agg = await tx.rating.aggregate({
                    where: { trainerId: approved.trainerId, status: "APPROVED" },
                    _avg: { stars: true },
                });

                const updated = await tx.trainerProfile.update({
                    where: { id: approved.trainerId },
                    data: {
                        clients: { increment: 1 },
                        rating: agg._avg.stars ?? 0,
                    },
                    select: { id: true, rating: true, clients: true },
                });

                return {
                    ratingStatus: "APPROVED",
                    target: "trainer",
                    targetId: updated.id,
                    newAverage: updated.rating,
                    clients: updated.clients,
                };
            }

            if (approved.gymId) {
                const agg = await tx.rating.aggregate({
                    where: { gymId: approved.gymId, status: "APPROVED" },
                    _avg: { stars: true },
                });

                const updated = await tx.gymProfile.update({
                    where: { id: approved.gymId },
                    data: {
                        clients: { increment: 1 },
                        rating: agg._avg.stars ?? 0,
                    },
                    select: { id: true, rating: true, clients: true },
                });

                return {
                    ratingStatus: "APPROVED",
                    target: "gym",
                    targetId: updated.id,
                    newAverage: updated.rating,
                    clients: updated.clients,
                };
            }

            throw new Error("Approved rating missing target");
        });

        return NextResponse.json(result);
    } catch (err) {
        console.error("PATCH /api/ratings/[id] error:", err);
        return NextResponse.json({ error: "Failed to update rating" }, { status: 500 });
    }
}
