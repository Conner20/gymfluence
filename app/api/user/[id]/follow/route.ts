// app/api/user/[id]/follow/route.ts
import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Follow / Request-to-follow target user
 * - Public target  -> ACCEPT immediately
 * - Private target -> PENDING (and creates FOLLOW_REQUEST notification)
 */
export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    const targetUserId = params.id;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const viewer = await db.user.findUnique({
        where: { email: session.user.email },
    });
    if (!viewer) return NextResponse.json({ message: "User not found" }, { status: 404 });
    if (viewer.id === targetUserId)
        return NextResponse.json({ message: "Cannot follow yourself" }, { status: 400 });

    const target = await db.user.findUnique({ where: { id: targetUserId } });
    if (!target) return NextResponse.json({ message: "Target not found" }, { status: 404 });

    const existing = await db.follow.findUnique({
        where: { followerId_followingId: { followerId: viewer.id, followingId: targetUserId } },
    });

    // Already accepted -> just return state (idempotent)
    if (existing?.status === "ACCEPTED") {
        const [followers, following] = await Promise.all([
            db.follow.count({ where: { followingId: targetUserId, status: "ACCEPTED" } }),
            db.follow.count({ where: { followerId: targetUserId, status: "ACCEPTED" } }),
        ]);
        return NextResponse.json({ followers, following, isFollowing: true, requested: false });
    }

    if (target.isPrivate) {
        // Private target: Keep/create PENDING
        const rel =
            existing ??
            (await db.follow.create({
                data: { followerId: viewer.id, followingId: targetUserId, status: "PENDING" },
            }));

        // Create FOLLOW_REQUEST notification for target
        await db.notification.create({
            data: {
                type: "FOLLOW_REQUEST",
                userId: targetUserId, // recipient (private user)
                actorId: viewer.id,   // requester
                followId: rel.id,
            },
        });

        const [followers, following] = await Promise.all([
            db.follow.count({ where: { followingId: targetUserId, status: "ACCEPTED" } }),
            db.follow.count({ where: { followerId: targetUserId, status: "ACCEPTED" } }),
        ]);
        return NextResponse.json({ followers, following, isFollowing: false, requested: true });
    }

    // Public target: ACCEPT immediately
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

/**
 * DELETE = cancel request OR unfollow (works for both PENDING and ACCEPTED)
 */
export async function DELETE(
    _req: Request,
    { params }: { params: { id: string } }
) {
    const targetUserId = params.id;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const viewer = await db.user.findUnique({ where: { email: session.user.email } });
    if (!viewer) return NextResponse.json({ message: "User not found" }, { status: 404 });
    if (viewer.id === targetUserId)
        return NextResponse.json({ message: "Cannot unfollow yourself" }, { status: 400 });

    const existing = await db.follow.findUnique({
        where: { followerId_followingId: { followerId: viewer.id, followingId: targetUserId } },
    });

    if (existing) {
        // If it's a pending request, deleting also implicitly retracts the request
        await db.follow.delete({ where: { id: existing.id } });
        // Optionally mark any related follow-request notifications as read
        await db.notification.updateMany({
            where: { followId: existing.id, type: "FOLLOW_REQUEST", userId: targetUserId, isRead: false },
            data: { isRead: true },
        });
    }

    const [followers, following] = await Promise.all([
        db.follow.count({ where: { followingId: targetUserId, status: "ACCEPTED" } }),
        db.follow.count({ where: { followerId: targetUserId, status: "ACCEPTED" } }),
    ]);
    return NextResponse.json({ followers, following, isFollowing: false, requested: false });
}
