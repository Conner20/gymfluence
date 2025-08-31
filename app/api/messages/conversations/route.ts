// app/api/messages/conversations/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

export async function GET() {
    const session = await getServerSession(authOptions);
    const meIdFromSession = (session?.user as any)?.id as string | undefined;
    const meEmail = session?.user?.email ?? undefined;
    if (!meIdFromSession && !meEmail) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const me = await db.user.findFirst({
        where: meIdFromSession ? { id: meIdFromSession } : { email: meEmail! },
        select: { id: true },
    });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    // Fetch conversations with last message + participants
    const rows = await db.conversation.findMany({
        where: { participants: { some: { userId: me.id } } },
        orderBy: { updatedAt: "asc" },
        include: {
            participants: {
                include: { user: { select: { id: true, username: true, name: true, image: true } } },
            },
            messages: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { id: true, content: true, imageUrls: true, createdAt: true, senderId: true },
            },
        },
        take: 100,
    });

    const convoIds = rows.map((c) => c.id);

    // Compute unread counts (messages from others with readAt = null)
    const unreadGroups = convoIds.length
        ? await db.message.groupBy({
            by: ["conversationId"],
            where: {
                conversationId: { in: convoIds },
                senderId: { not: me.id },
                readAt: null,
            },
            _count: { _all: true },
        })
        : [];

    const unreadMap = new Map<string, number>(
        unreadGroups.map((g) => [g.conversationId, (g as any)._count?._all ?? 0])
    );

    // Collapse accidental duplicates by OTHER USER id, keep newest
    const byOther = new Map<string, any>();
    for (const c of rows) {
        const others = c.participants.filter((p) => p.userId !== me.id).map((p) => p.user);
        const other = others[0] ?? null;
        if (!other) continue;

        const last = c.messages[0] ?? null;
        const payload = {
            id: c.id,
            updatedAt: c.updatedAt.toISOString(),
            other,
            lastMessage: last
                ? {
                    id: last.id,
                    content: last.content,
                    imageUrls: last.imageUrls,
                    createdAt: last.createdAt.toISOString(),
                    isMine: last.senderId === me.id,
                }
                : null,
            unreadCount: unreadMap.get(c.id) ?? 0,
        };

        const prev = byOther.get(other.id);
        const prevTs = prev ? new Date(prev.lastMessage?.createdAt || prev.updatedAt).getTime() : -1;
        const curTs = new Date(payload.lastMessage?.createdAt || payload.updatedAt).getTime();
        if (!prev || curTs > prevTs) byOther.set(other.id, payload);
    }

    const conversations = Array.from(byOther.values()).sort((a, b) => {
        const ta = new Date(a.lastMessage?.createdAt || a.updatedAt).getTime();
        const tb = new Date(b.lastMessage?.createdAt || b.updatedAt).getTime();
        return tb - ta;
    });

    return NextResponse.json(conversations);
}
