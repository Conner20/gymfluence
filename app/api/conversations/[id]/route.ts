// app/api/conversations/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

/** Leave / delete conversation */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    const meIdFromSession = (session?.user as any)?.id as string | undefined;
    const meEmail = session?.user?.email ?? undefined;
    if (!meIdFromSession && !meEmail) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const me = await db.user.findFirst({
        where: meIdFromSession ? { id: meIdFromSession } : { email: meEmail! },
        select: { id: true, username: true, name: true },
    });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const { id: convoId } = await params;

    const myRow = await db.conversationParticipant.findFirst({
        where: { conversationId: convoId, userId: me.id },
        select: { id: true },
    });
    if (!myRow) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const convo = await db.conversation.findUnique({
        where: { id: convoId },
        select: { id: true, dmKey: true },
    });
    if (!convo) return NextResponse.json({ message: "Conversation not found" }, { status: 404 });

    if (convo.dmKey) {
        await db.$transaction([
            db.message.deleteMany({ where: { conversationId: convoId } }),
            db.conversationParticipant.deleteMany({ where: { conversationId: convoId } }),
            db.conversation.delete({ where: { id: convoId } }),
        ]);
        return NextResponse.json({ ok: true, deleted: true, conversationId: convoId });
    }

    const actorLabel = me.username || me.name || "Someone";

    await db.$transaction([
        db.conversationParticipant.delete({ where: { id: myRow.id } }),
        db.message.create({
            data: {
                conversationId: convoId,
                senderId: me.id,
                content: `[SYS] ${actorLabel} left the conversation.`,
            },
        }),
        db.conversation.update({ where: { id: convoId }, data: {} }),
    ]);

    const remaining = await db.conversationParticipant.count({ where: { conversationId: convoId } });
    if (remaining < 2) {
        await db.$transaction([
            db.message.deleteMany({ where: { conversationId: convoId } }),
            db.conversation.delete({ where: { id: convoId } }),
        ]);
        return NextResponse.json({ ok: true, deleted: true, conversationId: convoId });
    }

    return NextResponse.json({ ok: true, deleted: false, conversationId: convoId });
}

/** Rename group conversation + post a system notice with old → new */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    const meIdFromSession = (session?.user as any)?.id as string | undefined;
    const meEmail = session?.user?.email ?? undefined;
    if (!meIdFromSession && !meEmail) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const me = await db.user.findFirst({
        where: meIdFromSession ? { id: meIdFromSession } : { email: meEmail! },
        select: { id: true, username: true, name: true },
    });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const { id: convoId } = await params;

    const member = await db.conversationParticipant.findFirst({
        where: { conversationId: convoId, userId: me.id },
        select: { id: true },
    });
    if (!member) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const convo = await db.conversation.findUnique({
        where: { id: convoId },
        select: { id: true, dmKey: true, name: true },
    });
    if (!convo) return NextResponse.json({ message: "Conversation not found" }, { status: 404 });
    if (convo.dmKey) return NextResponse.json({ message: "Cannot name a direct message" }, { status: 400 });

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }

    const raw = (body?.name ?? "").toString().trim();
    const newName = raw.length === 0 ? null : raw.slice(0, 80); // max length cap
    const oldName = convo.name ?? null;

    // No change → no-op
    if (newName === oldName) {
        return NextResponse.json({ conversationId: convoId, name: newName });
    }

    const actorLabel = me.username || me.name || "Someone";

    // Build a friendly system message
    let sys: string;
    if (oldName && newName) {
        sys = `[SYS] ${actorLabel} renamed the group from “${oldName}” to “${newName}”.`;
    } else if (!oldName && newName) {
        sys = `[SYS] ${actorLabel} named the group “${newName}”.`;
    } else {
        // newName === null && oldName
        sys = `[SYS] ${actorLabel} removed the group name (was “${oldName}”).`;
    }

    // Update name + create system message atomically
    const updated = await db.$transaction(async (tx) => {
        await tx.conversation.update({ where: { id: convoId }, data: { name: newName } });
        await tx.message.create({
            data: {
                conversationId: convoId,
                senderId: me.id, // who performed the action (rendered as grey system line in UI)
                content: sys,
            },
        });
        // Nudge updatedAt for ordering (name update already touches it, but keep consistent)
        await tx.conversation.update({ where: { id: convoId }, data: {} });
        const conv = await tx.conversation.findUnique({ where: { id: convoId }, select: { id: true, name: true } });
        return conv!;
    });

    return NextResponse.json({ conversationId: updated.id, name: updated.name ?? null });
}
