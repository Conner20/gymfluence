// app/api/notifications/[id]/respond/route.ts
import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    const notifId = params.id;
    const { action } = await req.json().catch(() => ({ action: undefined }));

    if (action !== "accept" && action !== "decline") {
        return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const me = await db.user.findUnique({ where: { email: session.user.email } });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const notif = await db.notification.findUnique({
        where: { id: notifId },
        include: { follow: true },
    });
    if (!notif || notif.userId !== me.id || notif.type !== "FOLLOW_REQUEST") {
        return NextResponse.json({ message: "Not found or not actionable" }, { status: 404 });
    }

    // Find follow record (fallback by user pair if needed)
    let follow = notif.follow;
    if (!follow) {
        // fallback: actor requested to follow me
        follow = await db.follow.findUnique({
            where: { followerId_followingId: { followerId: notif.actorId, followingId: me.id } },
        });
    }
    if (!follow) {
        await db.notification.update({ where: { id: notif.id }, data: { isRead: true } });
        return NextResponse.json({ message: "Follow relationship missing; marked read" });
    }

    if (action === "accept") {
        // Accept request
        await db.follow.update({ where: { id: follow.id }, data: { status: "ACCEPTED" } });

        // Notify requester that request was accepted
        await db.notification.create({
            data: {
                type: "REQUEST_ACCEPTED",
                userId: follow.followerId, // requester receives this
                actorId: me.id,            // me (the private user) accepted
                followId: follow.id,
            },
        });

        // Mark request notification as read
        await db.notification.update({
            where: { id: notif.id },
            data: { isRead: true },
        });

        return NextResponse.json({ ok: true, accepted: true });
    }

    // decline => delete the pending follow and mark notif read
    if (follow.status === "PENDING") {
        await db.follow.delete({ where: { id: follow.id } });
    }
    await db.notification.update({
        where: { id: notif.id },
        data: { isRead: true },
    });

    return NextResponse.json({ ok: true, accepted: false });
}
