// app/api/messages/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

// Resolve "to" value as id or username
async function resolveUser(toRaw: string) {
    const byId =
        (await db.user.findUnique({
            where: { id: toRaw },
            select: { id: true, username: true, name: true, image: true },
        })) ||
        (await db.user.findUnique({
            where: { username: toRaw },
            select: { id: true, username: true, name: true, image: true },
        }));
    return byId;
}

// Find or create 1:1 conversation using dmKey
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
 *   ?to=<userId|username>
 *   ?conversationId=<id>
 *   &cursor=<isoDateOptional>
 *
 * Returns last 50 messages and thread meta (DM or Group with name).
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const toRaw = searchParams.get("to");
    const conversationId = searchParams.get("conversationId");
    const cursor = searchParams.get("cursor");

    const session = await getServerSession(authOptions);
    if (!session?.user?.email && !(session?.user as any)?.id) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const me = await db.user.findFirst({
        where: (session?.user as any)?.id
            ? { id: (session?.user as any).id }
            : { email: session.user!.email as string },
        select: { id: true, username: true, name: true, image: true },
    });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    if (!toRaw && !conversationId) {
        return NextResponse.json({ message: "Missing 'to' or 'conversationId' param" }, { status: 400 });
    }

    let convoId: string;
    let other: any = null;
    let group: { name: string | null; members: any[] } | null = null;

    if (conversationId) {
        const convo = await db.conversation.findUnique({
            where: { id: conversationId },
            include: {
                participants: { include: { user: { select: { id: true, username: true, name: true, image: true } } } },
            },
        });
        if (!convo) return NextResponse.json({ message: "Conversation not found" }, { status: 404 });

        const amIn = convo.participants.some((p) => p.userId === me.id);
        if (!amIn) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        convoId = convo.id;

        const others = convo.participants.filter((p) => p.userId !== me.id).map((p) => p.user);
        if (convo.dmKey) {
            other = others[0] ?? null;
        } else {
            group = { name: convo.name ?? null, members: others };
        }
    } else {
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
            sharedUser: { select: { id: true, username: true, name: true, image: true } },
            sharedPost: {
                select: {
                    id: true,
                    title: true,
                    imageUrl: true,
                    author: { select: { id: true, username: true, name: true, image: true } },
                },
            },
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
        group,
        messages: messages.map((m) => ({
            id: m.id,
            content: m.content,
            imageUrls: m.imageUrls,
            createdAt: m.createdAt,
            isMine: m.senderId === me.id,
            readAt: m.readAt,
            sender: m.sender
                ? { id: m.sender.id, username: m.sender.username, name: m.sender.name, image: m.sender.image }
                : null,
            sharedUser: m.sharedUser
                ? { id: m.sharedUser.id, username: m.sharedUser.username, name: m.sharedUser.name, image: m.sharedUser.image }
                : null,
            sharedPost: m.sharedPost
                ? {
                    id: m.sharedPost.id,
                    title: m.sharedPost.title,
                    imageUrl: m.sharedPost.imageUrl,
                    author: {
                        id: m.sharedPost.author.id,
                        username: m.sharedPost.author.username,
                        name: m.sharedPost.author.name,
                        image: m.sharedPost.author.image,
                    },
                }
                : null,
        })),
    });
}

/**
 * POST /api/messages
 * body:
 *  - { to: string (id or username), content?: string, imageUrls?: string[], share?: { type:'user'|'post', id:string } }
 *  - OR { conversationId: string, content?: string, imageUrls?: string[], share?: { ... } }
 */
export async function POST(req: Request) {
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

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });

    const content = (body.content ?? "").toString();
    const imageUrls: string[] = Array.isArray(body.imageUrls) ? body.imageUrls.map(String) : [];
    const share = body.share && typeof body.share === "object" ? body.share : null;

    if (!content.trim() && imageUrls.length === 0 && !share) {
        return NextResponse.json({ message: "Message is empty" }, { status: 400 });
    }

    let convoId: string | null = null;

    if (body.conversationId) {
        convoId = String(body.conversationId);
        const member = await db.conversationParticipant.findFirst({
            where: { conversationId: convoId, userId: me.id },
            select: { id: true },
        });
        if (!member) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    } else if (body.to) {
        const other = await resolveUser(String(body.to));
        if (!other) return NextResponse.json({ message: "Target user not found" }, { status: 404 });
        if (other.id === me.id) return NextResponse.json({ message: "Cannot message yourself" }, { status: 400 });
        const convo = await findOrCreateDM(me.id, other.id);
        convoId = convo.id;
    } else {
        return NextResponse.json({ message: "Recipient missing" }, { status: 400 });
    }

    // Validate share target if present
    let sharedUserId: string | undefined = undefined;
    let sharedPostId: string | undefined = undefined;

    if (share) {
        const t = String(share.type || "").toLowerCase();
        const id = String(share.id || "");
        if (t === "user") {
            const user =
                (await db.user.findUnique({ where: { id }, select: { id: true } })) ||
                (await db.user.findUnique({ where: { username: id }, select: { id: true } }));
            if (!user) return NextResponse.json({ message: "User to share not found" }, { status: 404 });
            sharedUserId = user.id;
        } else if (t === "post") {
            const post = await db.post.findUnique({ where: { id }, select: { id: true } });
            if (!post) return NextResponse.json({ message: "Post to share not found" }, { status: 404 });
            sharedPostId = post.id;
        } else {
            return NextResponse.json({ message: "Invalid share.type" }, { status: 400 });
        }
    }

    const msg = await db.message.create({
        data: {
            conversationId: convoId!,
            senderId: me.id,
            content: content.trim(),
            imageUrls,
            sharedUserId,
            sharedPostId,
        },
    });

    await db.conversation.update({ where: { id: convoId! }, data: {} });

    return NextResponse.json({
        id: msg.id,
        createdAt: msg.createdAt,
        conversationId: convoId!,
    });
}
