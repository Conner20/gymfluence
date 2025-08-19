// app/api/user/notifications/[id]/accept/route.ts
import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
    _req: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const me = await db.user.findUnique({ where: { email: session.user.email } });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const notif = await db.notification.findUnique({
        where: { id: params.id },
        include: { follow: true, actor: true },
    });
    if (!notif || notif.userId !== me.id || notif.type !== "FOLLOW_REQUEST" || !notif.follow) {
        return NextResponse.json({ message: "Invalid notification" }, { status: 400 });
    }

    // Accept request
    await db.follow.update({
        where: { id: notif.followId! },
        data: { status: "ACCEPTED" },
    });

    await db.notification.update({
        where: { id: notif.id },
        data: { isRead: true },
    });

    // Let the requester know it was accepted
    await db.notification.create({
        data: {
            type: "REQUEST_ACCEPTED",
            userId: notif.actorId,
            actorId: me.id,
            followId: notif.followId!,
        },
    });

    return NextResponse.json({ ok: true });
}
