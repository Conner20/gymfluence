// app/api/messages/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

// resolve "to" as id or username
async function resolveUser(toRaw: string) {
    const byId = await db.user.findUnique({
        where: { id: toRaw },
        select: { id: true, username: true, name: true, image: true },
    });
    if (byId) return byId;

    const byUsername = await db.user.findUnique({
        where: { username: toRaw },
        select: { id: true, username: true, name: true, image: true },
    });
    return byUsername;
}

// ensure/find 1:1 DM by dmKey
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
                participants: { create: [{ userId: meId }, { userId: otherId }] },
            },
            select: { id: true },
        });
    }
    return convo;
}

/**
 * GET /api/messages?to=<userId|username>&cursor=<isoDateOptional>
 * Returns conversationId, other user, and last 50 messages (with imageUrls).
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
            imageUrls: true,
            createdAt: true,
            readAt: true,
            senderId: true,
        },
    });

    // mark as read for others' messages
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
            imageUrls: m.imageUrls,
            createdAt: m.createdAt.toISOString(),
            isMine: m.senderId === me.id,
            readAt: m.readAt ? m.readAt.toISOString() : null,
        })),
    });
}

/**
 * POST /api/messages
 * Body: { to: string (id or username), content?: string, imageUrls?: string[] }
 * Accepts text-only, image-only, or text+image messages.
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

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }

    const toRaw = body?.to as string | undefined;
    const text = (body?.content ?? "").trim() as string;
    const imgs = Array.isArray(body?.imageUrls) ? (body.imageUrls as string[]).filter(Boolean) : [];

    if (!toRaw) return NextResponse.json({ message: "Recipient is required" }, { status: 400 });
    if (!text && imgs.length === 0) {
        return NextResponse.json({ message: "Message must include text or images" }, { status: 400 });
    }

    const other = await resolveUser(toRaw);
    if (!other) return NextResponse.json({ message: "Target user not found" }, { status: 404 });
    if (other.id === me.id) return NextResponse.json({ message: "Cannot message yourself" }, { status: 400 });

    const convo = await findOrCreateDM(me.id, other.id);

    const msg = await db.message.create({
        data: {
            conversationId: convo.id,
            senderId: me.id,
            content: text,     // can be empty string
            imageUrls: imgs,   // array of URLs (can be empty)
        },
        select: { id: true, createdAt: true },
    });

    // bump updatedAt via @updatedAt
    await db.conversation.update({ where: { id: convo.id }, data: {} });

    return NextResponse.json({
        id: msg.id,
        createdAt: msg.createdAt.toISOString(),
        conversationId: convo.id,
    });
}
