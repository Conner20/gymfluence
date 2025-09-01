// app/api/messages/conversations/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email && !(session?.user as any)?.id) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const me = await db.user.findFirst({
        where: (session?.user as any)?.id
            ? { id: (session?.user as any).id }
            : { email: session.user!.email as string },
        select: { id: true },
    });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const rows = await db.conversation.findMany({
        where: { participants: { some: { userId: me.id } } },
        orderBy: { updatedAt: "desc" },
        include: {
            participants: {
                include: { user: { select: { id: true, username: true, name: true, image: true } } },
            },
            messages: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: { sender: { select: { id: true } } },
            },
        },
    });

    // Build payloads + unread counts
    const payloads = await Promise.all(
        rows.map(async (c) => {
            const others = c.participants.filter((p) => p.userId !== me.id).map((p) => p.user);
            const isGroup = others.length >= 2;
            const last = c.messages[0] ?? null;

            const unreadCount = await db.message.count({
                where: { conversationId: c.id, senderId: { not: me.id }, readAt: null },
            });

            return {
                id: c.id,
                updatedAt: c.updatedAt,
                isGroup,
                groupName: c.name ?? null,
                groupMembers: isGroup ? others : undefined,
                other: !isGroup ? (others[0] ?? null) : null,
                lastMessage: last
                    ? {
                        id: last.id,
                        content: last.content,
                        createdAt: last.createdAt,
                        isMine: last.senderId === me.id,
                        imageUrls: last.imageUrls,
                    }
                    : null,
                unreadCount,
            };
        })
    );

    return NextResponse.json(payloads);
}
