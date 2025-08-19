// app/api/user/[id]/follow-state/route.ts
import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: targetUserId } = await params;

    // Who is viewing?
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
        db.follow.count({ where: { followingId: targetUserId, status: "ACCEPTED" } }),
        db.follow.count({ where: { followerId: targetUserId, status: "ACCEPTED" } }),
    ]);

    let isFollowing = false;
    let requested = false;

    if (viewerId && viewerId !== targetUserId) {
        const rel = await db.follow.findUnique({
            where: {
                followerId_followingId: {
                    followerId: viewerId,
                    followingId: targetUserId,
                },
            },
            select: { status: true },
        });
        if (rel?.status === "ACCEPTED") isFollowing = true;
        else if (rel?.status === "PENDING") requested = true;
    }

    return NextResponse.json({ followers, following, isFollowing, requested });
}
