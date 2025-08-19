// app/api/user/notifications/[id]/respond/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const me = await db.user.findUnique({
        where: { email: session.user.email },
    });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const notificationId = params.id;
    const { action } = await req.json();

    if (!["accept", "decline"].includes(action)) {
        return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    }

    const notif = await db.notification.findFirst({
        where: { id: notificationId, userId: me.id },
    });
    if (!notif) return NextResponse.json({ message: "Notification not found" }, { status: 404 });

    if (notif.type !== "FOLLOW_REQUEST" || !notif.followId) {
        await db.notification.delete({ where: { id: notif.id } });
        return NextResponse.json({ ok: true });
    }

    const follow = await db.follow.findUnique({ where: { id: notif.followId } });
    if (!follow || follow.followingId !== me.id) {
        await db.notification.delete({ where: { id: notif.id } });
        return NextResponse.json({ ok: true });
    }

    if (action === "accept") {
        await db.$transaction(async (tx) => {
            await tx.follow.update({
                where: { id: follow.id },
                data: { status: "ACCEPTED" },
            });

            await tx.notification.create({
                data: {
                    type: "REQUEST_ACCEPTED",
                    userId: follow.followerId,
                    actorId: me.id,
                    followId: follow.id,
                },
            });

            await tx.notification.delete({ where: { id: notif.id } });
        });

        return NextResponse.json({ ok: true, status: "accepted" });
    } else {
        await db.$transaction(async (tx) => {
            await tx.follow.delete({ where: { id: follow.id } });
            await tx.notification.delete({ where: { id: notif.id } });
        });

        return NextResponse.json({ ok: true, status: "declined" });
    }
}
