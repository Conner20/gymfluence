// app/api/messages/conversations/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

function lite(u: any) {
    return u ? { id: u.id, username: u.username, name: u.name, image: u.image } : null;
}

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
                select: { id: true, content: true, imageUrls: true, createdAt: true, senderId: true },
            },
        },
        take: 200,
    });

    const convoIds = rows.map((c) => c.id);

    // unread counts for each conversation
    const unreadGroups = convoIds.length
        ? await db.message.groupBy({
            by: ["conversationId"],
            where: { conversationId: { in: convoIds }, senderId: { not: me.id }, readAt: null },
            _count: { _all: true },
        })
        : [];
    const unreadMap = new Map<string, number>(
        unreadGroups.map((g) => [g.conversationId, (g as any)._count?._all ?? 0])
    );

    const items = rows.map((c) => {
        const others = c.participants.filter((p) => p.userId !== me.id).map((p) => p.user);

        // Treat as group ONLY if 3+ participants (you + at least 2 others).
        const isGroup = c.participants.length >= 3;

        const last = c.messages[0] ?? null;

        let groupName: string | undefined = undefined;
        if (isGroup) {
            const names = others.map((u) => u.username || u.name || "User");
            groupName = names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "");
        }

        return {
            id: c.id,
            updatedAt: c.updatedAt.toISOString(),
            isGroup,
            groupName,
            groupMembers: isGroup ? others.map(lite) : undefined,
            other: !isGroup ? lite(others[0]) : null,
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
    });

    // Collapse DMs by other user id (whether they came from a dmKey or a legacy 2-person "group")
    const dmByOther = new Map<string, any>();
    const groups: any[] = [];
    for (const it of items) {
        if (it.isGroup) {
            groups.push(it);
            continue;
        }
        const oid = it.other?.id;
        if (!oid) continue;
        const prev = dmByOther.get(oid);
        const prevTs = prev ? new Date(prev.lastMessage?.createdAt || prev.updatedAt).getTime() : -1;
        const curTs = new Date(it.lastMessage?.createdAt || it.updatedAt).getTime();
        dmByOther.set(oid, !prev || curTs > prevTs ? it : prev);
    }

    const result = [...groups, ...Array.from(dmByOther.values())];
    result.sort((a, b) => {
        const ta = new Date(a.lastMessage?.createdAt || a.updatedAt).getTime();
        const tb = new Date(b.lastMessage?.createdAt || b.updatedAt).getTime();
        return tb - ta;
    });

    return NextResponse.json(result);
}
