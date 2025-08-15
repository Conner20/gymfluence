// app/api/users/[id]/follow/route.ts
import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> } // 👈 params is a Promise
) {
    try {
        const { id: targetUserId } = await params; // 👈 await it

        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const viewer = await db.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        if (!viewer) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }
        if (viewer.id === targetUserId) {
            return NextResponse.json({ message: "Cannot follow yourself" }, { status: 400 });
        }

        const { action } = await req.json().catch(() => ({} as any));

        const existing = await db.follow.findUnique({
            where: {
                followerId_followingId: {
                    followerId: viewer.id,
                    followingId: targetUserId,
                },
            },
            select: { id: true },
        });

        if (action === "follow") {
            if (!existing) {
                await db.follow.create({
                    data: { followerId: viewer.id, followingId: targetUserId },
                });
            }
        } else if (action === "unfollow") {
            if (existing) {
                await db.follow.delete({ where: { id: existing.id } });
            }
        } else {
            // Toggle if no explicit action provided
            if (existing) {
                await db.follow.delete({ where: { id: existing.id } });
            } else {
                await db.follow.create({
                    data: { followerId: viewer.id, followingId: targetUserId },
                });
            }
        }

        // Return fresh state
        const [followers, following, nowExisting] = await Promise.all([
            db.follow.count({ where: { followingId: targetUserId } }),
            db.follow.count({ where: { followerId: targetUserId } }),
            db.follow.findUnique({
                where: {
                    followerId_followingId: {
                        followerId: viewer.id,
                        followingId: targetUserId,
                    },
                },
                select: { id: true },
            }),
        ]);

        return NextResponse.json({
            followers,
            following,
            isFollowing: !!nowExisting,
        });
    } catch (e) {
        console.error("POST /user/[id]/follow error:", e);
        return NextResponse.json({ message: "Failed to update follow" }, { status: 500 });
    }
}
