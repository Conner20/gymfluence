// app/api/notifications/route.ts
import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const me = await db.user.findUnique({ where: { email: session.user.email } });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const notifications = await db.notification.findMany({
        where: { userId: me.id },
        orderBy: { createdAt: "desc" },
        include: {
            actor: { select: { id: true, username: true, name: true, image: true } },
            follow: { select: { id: true, followerId: true, followingId: true, status: true } },
        },
    });

    return NextResponse.json(notifications);
}
