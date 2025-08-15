// app/api/users/[id]/follow-state/route.ts
import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> } // 👈 params is a Promise
) {
    try {
        const { id: targetUserId } = await params; // 👈 await it

        const session = await getServerSession(authOptions);

        let viewerId: string | null = null;
        if (session?.user?.email) {
            const viewer = await db.user.findUnique({
                where: { email: session.user.email },
                select: { id: true },
            });
            viewerId = viewer?.id ?? null;
        }

        const [followers, following] = await Promise.all([
            db.follow.count({ where: { followingId: targetUserId } }),
            db.follow.count({ where: { followerId: targetUserId } }),
        ]);

        let isFollowing = false;
        if (viewerId && viewerId !== targetUserId) {
            const existing = await db.follow.findUnique({
                where: {
                    followerId_followingId: {
                        followerId: viewerId,
                        followingId: targetUserId,
                    },
                },
                select: { id: true },
            });
            isFollowing = !!existing;
        }

        return NextResponse.json({ followers, following, isFollowing });
    } catch (e) {
        console.error("GET /user/[id]/follow-state error:", e);
        return NextResponse.json({ message: "Failed to load follow state" }, { status: 500 });
    }
}
