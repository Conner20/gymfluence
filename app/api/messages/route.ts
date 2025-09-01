// app/api/messages/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

type LiteUser = { id: string; username: string | null; name: string | null; image: string | null };

// Helper: resolve "to" value as id or username
async function resolveUser(toRaw: string) {
    const user =
        (await db.user.findUnique({
            where: { id: toRaw },
            select: { id: true, username: true, name: true, image: true },
        })) ||
        (await db.user.findUnique({
            where: { username: toRaw },
            select: { id: true, username: true, name: true, image: true },
        }));
    return user;
}

// Helper: find or create 1:1 conversation using dmKey
async function findOrCreateDM(meId: string, otherId: string) {
    const key = [meId, otherId].sort().join(":");
    let convo = await db.conversation.findUnique({ where: { dmKey: key }, select: { id: true } });
    if (!convo) {
        convo = await db.conversation.create({
            data: {
                dmKey: key,
                participants: { create: [{ userId: meId }, { userId: otherId }] },
            },
            select: { id: true },
        });
    }
    return convo;
}

/**
 * GET /api/messages
 *   ?to=<userId|username>  (DM)
 *   ?conversationId=<id>   (DM or Group)
 *   [&cursor=<isoDate>]
 * Returns last 50 messages + participants info.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const toRaw = searchParams.get("to");
    const conversationId = searchParams.get("conversationId");
    const cursor = searchParams.get("cursor");

    const session = await getServerSession(authOptions);
    const meIdFromSession = (session?.user as any)?.id as string | undefined;
    const meEmail = session?.user?.email ?? undefined;
    if (!meIdFromSession && !meEmail) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const me = await db.user.findFirst({
        where: meIdFromSession ? { id: meIdFromSession } : { email: meEmail! },
        select: { id: true, username: true, name: true, image: true },
    });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    if (!toRaw && !conversationId) {
        return NextResponse.json({ message: "Missing 'to' or 'conversationId' param" }, { status: 400 });
    }

    let convoId: string;
    let other: LiteUser | null = null;
    let groupMembers: LiteUser[] | null = null;

    if (conversationId) {
        // Load an existing conversation (DM or group)
        const convo = await db.conversation.findUnique({
            where: { id: conversationId },
            include: {
                participants: { include: { user: { select: { id: true, username: true, name: true, image: true } } } },
            },
        });
        if (!convo) return NextResponse.json({ message: "Conversation not found" }, { status: 404 });

        const amIn = convo.participants.some((p) => p.userId === me.id);
        if (!amIn) return NextResponse.json({ message: "Not a participant" }, { status: 403 });

        convoId = convo.id;
        const others = convo.participants.filter((p) => p.userId !== me.id).map((p) => p.user) as LiteUser[];
        if (others.length === 1) {
            other = others[0]!;
        } else {
            groupMembers = others;
        }
    } else {
        // DM by "to"
        const otherUser = await resolveUser(toRaw!);
        if (!otherUser) return NextResponse.json({ message: "Target user not found" }, { status: 404 });
        if (otherUser.id === me.id) return NextResponse.json({ message: "Cannot message yourself" }, { status: 400 });
        const convo = await findOrCreateDM(me.id, otherUser.id);
        convoId = convo.id;
        other = otherUser;
    }

    const where: any = { conversationId: convoId };
    if (cursor) {
        const since = new Date(cursor);
        if (!isNaN(since.getTime())) where.createdAt = { gt: since };
    }

    const messages = await db.message.findMany({
        where,
        orderBy: { createdAt: "asc" },
        take: 50,
        include: {
            sender: { select: { id: true, username: true, name: true, image: true } },
        },
    });

    // Mark others' messages as read
    await db.message.updateMany({
        where: { conversationId: convoId, senderId: { not: me.id }, readAt: null },
        data: { readAt: new Date() },
    });

    return NextResponse.json({
        conversationId: convoId,
        other,
        group: groupMembers ? { members: groupMembers } : undefined,
        messages: messages.map((m) => ({
            id: m.id,
            content: m.content,
            imageUrls: m.imageUrls,
            createdAt: m.createdAt,
            isMine: m.senderId === me.id,
            readAt: m.readAt,
            sender: m.sender ? { id: m.sender.id, username: m.sender.username, name: m.sender.name, image: m.sender.image } : null,
        })),
    });
}

/**
 * POST /api/messages
 * body: 
 *   - DM:   { to: string (id or username), content?: string, imageUrls?: string[] }
 *   - Any:  { conversationId: string, content?: string, imageUrls?: string[] }
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    const meIdFromSession = (session?.user as any)?.id as string | undefined;
    const meEmail = session?.user?.email ?? undefined;
    if (!meIdFromSession && !meEmail) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const me = await db.user.findFirst({
        where: meIdFromSession ? { id: meIdFromSession } : { email: meEmail! },
        select: { id: true },
    });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const body = await req.json();
    const { to: toRaw, content, imageUrls, conversationId } = body || {};

    let convoId: string | null = null;

    if (conversationId) {
        const exists = await db.conversation.findUnique({
            where: { id: conversationId },
            include: { participants: true },
        });
        if (!exists) return NextResponse.json({ message: "Conversation not found" }, { status: 404 });
        const amIn = exists.participants.some((p) => p.userId === me.id);
        if (!amIn) return NextResponse.json({ message: "Not a participant" }, { status: 403 });
        convoId = exists.id;
    } else {
        if (!toRaw) return NextResponse.json({ message: "Recipient required" }, { status: 400 });
        const other = await resolveUser(toRaw);
        if (!other) return NextResponse.json({ message: "Target user not found" }, { status: 404 });
        if (other.id === me.id) return NextResponse.json({ message: "Cannot message yourself" }, { status: 400 });
        const convo = await findOrCreateDM(me.id, other.id);
        convoId = convo.id;
    }

    if (!content?.trim() && (!Array.isArray(imageUrls) || imageUrls.length === 0)) {
        return NextResponse.json({ message: "Content or image required" }, { status: 400 });
    }

    const msg = await db.message.create({
        data: {
            conversationId: convoId!,
            senderId: me.id,
            content: content?.trim() ?? "",
            imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
        },
    });

    // touch updatedAt
    await db.conversation.update({ where: { id: convoId! }, data: {} });

    return NextResponse.json({
        id: msg.id,
        createdAt: msg.createdAt,
        conversationId: convoId!,
    });
}
