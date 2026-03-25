import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

export async function DELETE(
    _req: Request,
    context: { params: Promise<{ id: string }> },
) {
    const { id } = await context.params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const me = await db.user.findUnique({
        where: { email: session.user.email.toLowerCase() },
        select: { id: true },
    });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    await db.notificationDismissal.upsert({
        where: {
            userId_notificationId: {
                userId: me.id,
                notificationId: id,
            },
        },
        update: {},
        create: {
            userId: me.id,
            notificationId: id,
        },
    });

    return NextResponse.json({ ok: true });
}
