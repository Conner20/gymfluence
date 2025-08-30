// app/api/messages/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

// Helper: resolve "to" value as id or username
async function resolveUser(toRaw: string) {
    let user =
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

// Helper: find or create 1:1 conversation using dmKey + participants
async function findOrCreateDM(meId: string, otherId: string) {
    const key = [meId, otherId].sort().join(":");
    let convo = await db.conversation.findUnique({
        where: { dmKey: key },
        select: { id: true },
    });

    if (!convo) {
        convo = await db.conversation.create({
            data: {
                dmKey: key,
                participants: {
                    create: [{ userId: meId }, { userId: otherId }],
                },
            },
            select: { id: true },
        });
    }
    return convo;
}

/**
 * GET /api/messages?to=<userId|username>&cursor=<isoDateOptional>
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const toRaw = searchParams.get("to");
    const cursor = searchParams.get("cursor") ?? undefined;

    const session = await getServerSession(authOptions);
    const meIdFromSession = (session?.user as any)?.id as string | undefined;
    const meEmail = session?.user?.email ?? undefined;
    if (!meIdFromSession && !meEmail) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const me = await db.user.findFirst({
        where: meIdFromSession ? { id: meIdFromSession } : { email: meEmail! },
        select: { id: true, username: true, name: true, image: true },
    });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    if (!toRaw) return NextResponse.json({ message: "Missing 'to' param" }, { status: 400 });

    const other = await resolveUser(toRaw);
    if (!other) return NextResponse.json({ message: "Target user not found" }, { status: 404 });
    if (other.id === me.id) return NextResponse.json({ message: "Cannot message yourself" }, { status: 400 });

    const convo = await findOrCreateDM(me.id, other.id);

    const where: any = { conversationId: convo.id };
    if (cursor) {
        const since = new Date(cursor);
        if (!isNaN(since.getTime())) where.createdAt = { gt: since };
    }

    const messages = await db.message.findMany({
        where,
        orderBy: { createdAt: "asc" },
        take: 50,
        select: {
            id: true,
            content: true,
            createdAt: true,
            readAt: true,
            senderId: true,
        },
    });

    // Mark others' messages as read
    await db.message.updateMany({
        where: { conversationId: convo.id, senderId: { not: me.id }, readAt: null },
        data: { readAt: new Date() },
    });

    return NextResponse.json({
        conversationId: convo.id,
        other,
        messages: messages.map((m) => ({
            id: m.id,
            content: m.content,
            createdAt: m.createdAt.toISOString(),
            isMine: m.senderId === me.id,
            readAt: m.readAt ? m.readAt.toISOString() : null,
        })),
    });
}

/**
 * POST /api/messages
 * body: { to: string (id or username), content: string }
 */
export async function POST(req: Request) {
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

    const { to: toRaw, content } = await req.json();
    if (!toRaw || !content?.trim()) {
        return NextResponse.json({ message: "Recipient and content are required" }, { status: 400 });
    }

    const other = await resolveUser(toRaw);
    if (!other) return NextResponse.json({ message: "Target user not found" }, { status: 404 });
    if (other.id === me.id) return NextResponse.json({ message: "Cannot message yourself" }, { status: 400 });

    const convo = await findOrCreateDM(me.id, other.id);

    const msg = await db.message.create({
        data: {
            conversationId: convo.id,
            senderId: me.id,
            content: content.trim(),
        },
        select: { id: true, createdAt: true },
    });

    await db.conversation.update({
        where: { id: convo.id },
        data: {}, // @updatedAt bumps
    });

    return NextResponse.json({
        id: msg.id,
        createdAt: msg.createdAt.toISOString(),
        conversationId: convo.id,
    });
}
