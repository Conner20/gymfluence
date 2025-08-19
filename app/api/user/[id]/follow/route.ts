// app/api/user/[id]/follow/route.ts
import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id: targetUserId } = await ctx.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const viewer = await db.user.findUnique({ where: { email: session.user.email } });
    if (!viewer) return NextResponse.json({ message: "User not found" }, { status: 404 });
    if (viewer.id === targetUserId) return NextResponse.json({ message: "Cannot follow yourself" }, { status: 400 });

    const target = await db.user.findUnique({ where: { id: targetUserId } });
    if (!target) return NextResponse.json({ message: "Target not found" }, { status: 404 });

    const existing = await db.follow.findUnique({
        where: { followerId_followingId: { followerId: viewer.id, followingId: targetUserId } },
    });

    // Already accepted — idempotent
    if (existing?.status === "ACCEPTED") {
        const [followers, following] = await Promise.all([
            db.follow.count({ where: { followingId: targetUserId, status: "ACCEPTED" } }),
            db.follow.count({ where: { followerId: targetUserId, status: "ACCEPTED" } }),
        ]);
        return NextResponse.json({ followers, following, isFollowing: true, requested: false });
    }

    if (target.isPrivate) {
        const rel = existing
            ? existing
            : await db.follow.create({
                data: { followerId: viewer.id, followingId: targetUserId, status: "PENDING" },
            });

        // Only create a request notification if it wasn't already pending
        if (!existing) {
            await db.notification.create({
                data: {
                    type: "FOLLOW_REQUEST",
                    userId: targetUserId, // recipient
                    actorId: viewer.id,
                    followId: rel.id,
                },
            });
        }

        const [followers, following] = await Promise.all([
            db.follow.count({ where: { followingId: targetUserId, status: "ACCEPTED" } }),
            db.follow.count({ where: { followerId: targetUserId, status: "ACCEPTED" } }),
        ]);
        return NextResponse.json({ followers, following, isFollowing: false, requested: true });
    } else {
        const rel = await db.follow.upsert({
            where: { followerId_followingId: { followerId: viewer.id, followingId: targetUserId } },
            update: { status: "ACCEPTED" },
            create: { followerId: viewer.id, followingId: targetUserId, status: "ACCEPTED" },
        });

        await db.notification.create({
            data: {
                type: "FOLLOWED_YOU",
                userId: targetUserId,
                actorId: viewer.id,
                followId: rel.id,
            },
        });

        const [followers, following] = await Promise.all([
            db.follow.count({ where: { followingId: targetUserId, status: "ACCEPTED" } }),
            db.follow.count({ where: { followerId: targetUserId, status: "ACCEPTED" } }),
        ]);

        return NextResponse.json({ followers, following, isFollowing: true, requested: false });
    }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id: targetUserId } = await ctx.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const viewer = await db.user.findUnique({ where: { email: session.user.email } });
    if (!viewer) return NextResponse.json({ message: "User not found" }, { status: 404 });
    if (viewer.id === targetUserId) return NextResponse.json({ message: "Cannot unfollow yourself" }, { status: 400 });

    const existing = await db.follow.findUnique({
        where: { followerId_followingId: { followerId: viewer.id, followingId: targetUserId } },
    });

    if (existing) {
        await db.follow.delete({ where: { id: existing.id } });
    }

    const [followers, following] = await Promise.all([
        db.follow.count({ where: { followingId: targetUserId, status: "ACCEPTED" } }),
        db.follow.count({ where: { followerId: targetUserId, status: "ACCEPTED" } }),
    ]);

    return NextResponse.json({ followers, following, isFollowing: false, requested: false });
}
