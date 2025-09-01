// app/api/conversations/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

/**
 * DELETE /api/conversations/:id
 * - If DM: delete the entire conversation (and messages).
 * - If GROUP: current user leaves; post a [SYS] "<user> left..." message; if <2 remain, delete conversation.
 */
export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
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

    const convoId = params.id;

    // Ensure membership
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

    // DM => hard delete
    if (convo.dmKey) {
        await db.$transaction([
            db.message.deleteMany({ where: { conversationId: convoId } }),
            db.conversationParticipant.deleteMany({ where: { conversationId: convoId } }),
            db.conversation.delete({ where: { id: convoId } }),
        ]);
        return NextResponse.json({ ok: true, deleted: true, conversationId: convoId });
    }

    // GROUP => leave
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

    // If fewer than 2 remain, delete conversation
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
