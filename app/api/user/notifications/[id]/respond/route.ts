import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

/**
 * Path: /api/user/notifications/[id]/respond
 * Body: { action: "accept" | "decline" }
 */
export async function POST(
    req: Request,
    ctx: { params: Promise<{ id: string }> } // IMPORTANT: must await in App Router
) {
    try {
        const { id: notificationId } = await ctx.params;

        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const me = await db.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

        const { action } = (await req.json().catch(() => ({}))) as {
            action?: "accept" | "decline";
        };
        if (action !== "accept" && action !== "decline") {
            return NextResponse.json({ message: "Invalid action" }, { status: 400 });
        }

        // Load actionable notification and ensure it belongs to me.
        const notification = await db.notification.findUnique({
            where: { id: notificationId },
            select: {
                id: true,
                type: true,
                userId: true,     // recipient (me)
                actorId: true,    // requester
                followId: true,   // pending follow row (if any)
            },
        });

        // If it doesn't exist or isn't mine, treat as handled (idempotent).
        if (!notification || notification.userId !== me.id) {
            return NextResponse.json({ ok: true });
        }

        // Only follow requests are actionable; anything else -> mark as read and exit.
        if (notification.type !== "FOLLOW_REQUEST") {
            await db.notification.update({
                where: { id: notification.id },
                data: { isRead: true },
            });
            return NextResponse.json({ ok: true });
        }

        // Ensure the follow row still exists and actually targets me.
        const follow = notification.followId
            ? await db.follow.findUnique({
                where: { id: notification.followId },
                select: { id: true, followerId: true, followingId: true, status: true },
            })
            : null;

        if (action === "accept") {
            if (follow && follow.followingId === me.id) {
                await db.$transaction(async (tx: Prisma.TransactionClient) => {
                    // Accept the follow
                    await tx.follow.update({
                        where: { id: follow.id },
                        data: { status: "ACCEPTED" },
                    });

                    // Notify requester that their request was accepted
                    await tx.notification.create({
                        data: {
                            type: "REQUEST_ACCEPTED",
                            userId: follow.followerId, // recipient = requester
                            actorId: me.id,            // actor = me (the private user)
                            followId: follow.id,
                        },
                    });

                    // Clean up the original request notification (idempotent)
                    await tx.notification.deleteMany({
                        where: { id: notification.id, userId: me.id },
                    });
                });
            } else {
                // Nothing to accept; just mark/delete the original notification safely
                await db.notification.deleteMany({
                    where: { id: notification.id, userId: me.id },
                });
            }

            return NextResponse.json({ ok: true, status: "ACCEPTED" });
        }

        // action === "decline"
        await db.$transaction(async (tx: Prisma.TransactionClient) => {
            // If the pending follow still exists and targets me, remove it
            if (follow && follow.followingId === me.id) {
                await tx.follow.deleteMany({ where: { id: follow.id } }); // idempotent-safe
            }

            // Remove the original notification (use deleteMany to avoid P2025)
            await tx.notification.deleteMany({
                where: { id: notification.id, userId: me.id },
            });
        });

        // You could create an optional "REQUEST_DECLINED" notification to the requester here.
        return NextResponse.json({ ok: true, status: "DECLINED" });
    } catch (err) {
        console.error("notifications respond error", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
