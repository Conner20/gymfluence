// app/api/conversations/[id]/participants/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

/** Resolve a user by id OR username */
async function resolveUserId(idOrUsername: string) {
    // try id
    const byId = await db.user.findUnique({
        where: { id: idOrUsername },
        select: { id: true },
    });
    if (byId) return byId.id;

    // try username
    const byUsername = await db.user.findUnique({
        where: { username: idOrUsername },
        select: { id: true },
    });
    return byUsername?.id ?? null;
}

// -------------------- ADD PARTICIPANTS --------------------
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    // Caller must be a current participant
    const meParticipant = await db.conversationParticipant.findFirst({
        where: { conversationId: convoId, userId: me.id },
        select: { id: true },
    });
    if (!meParticipant) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    const rawList: string[] = Array.isArray(body?.userIds) ? body.userIds.map(String) : [];
    if (rawList.length === 0) {
        return NextResponse.json({ message: "Provide at least one user to add." }, { status: 400 });
    }

    // Resolve identifiers to ids
    const resolved: string[] = [];
    for (const entry of rawList) {
        const uid = await resolveUserId(entry);
        if (uid) resolved.push(uid);
    }

    // Exclude me and existing participants, dedupe
    const existing = await db.conversationParticipant.findMany({
        where: { conversationId: convoId },
        select: { userId: true },
    });
    const existingIds = new Set(existing.map((r) => r.userId));
    const toAdd = Array.from(new Set(resolved)).filter((id) => id !== me.id && !existingIds.has(id));

    if (toAdd.length === 0) {
        return NextResponse.json({ message: "No new participants to add." }, { status: 400 });
    }

    // Ensure all users exist
    const found = await db.user.findMany({
        where: { id: { in: toAdd } },
        select: { id: true, username: true, name: true },
    });
    if (found.length !== toAdd.length) {
        return NextResponse.json({ message: "One or more selected users do not exist." }, { status: 400 });
    }

    // Add participants + system message + bump updatedAt
    const actorLabel = me.username || me.name || "Someone";
    const addedLabels = found.map((u) => u.username || u.name || "a user");
    const listText =
        addedLabels.length === 1
            ? addedLabels[0]
            : addedLabels.length === 2
                ? `${addedLabels[0]} and ${addedLabels[1]}`
                : `${addedLabels.slice(0, -1).join(", ")}, and ${addedLabels.slice(-1)[0]}`;

    await db.$transaction([
        db.conversationParticipant.createMany({
            data: toAdd.map((userId) => ({ conversationId: convoId, userId })),
            skipDuplicates: true,
        }),
        db.message.create({
            data: {
                conversationId: convoId,
                senderId: me.id,
                // Prefix with [SYS] so the client renders it as a grey system line (no bubble)
                content: `[SYS] ${actorLabel} added ${listText} to the conversation.`,
            },
        }),
        db.conversation.update({ where: { id: convoId }, data: {} }),
    ]);

    // Return refreshed participant list
    const participants = await db.conversationParticipant.findMany({
        where: { conversationId: convoId },
        include: { user: { select: { id: true, username: true, name: true, image: true } } },
        orderBy: { id: "asc" },
    });

    return NextResponse.json({
        ok: true,
        conversationId: convoId,
        participants: participants.map((p) => ({
            id: p.user.id,
            username: p.user.username,
            name: p.user.name,
            image: p.user.image,
        })),
    });
}

// -------------------- REMOVE PARTICIPANT --------------------
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

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    const userId: string | undefined = body?.userId;
    if (!userId) {
        return NextResponse.json({ message: "Missing userId" }, { status: 400 });
    }

    // Must be a participant to manage the conversation
    const meParticipant = await db.conversationParticipant.findFirst({
        where: { conversationId: convoId, userId: me.id },
        select: { id: true },
    });
    if (!meParticipant) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Target must be a participant
    const targetRow = await db.conversationParticipant.findFirst({
        where: { conversationId: convoId, userId },
        select: { id: true, userId: true },
    });
    if (!targetRow) {
        return NextResponse.json({ message: "User is not in the conversation" }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({
        where: { id: targetRow.userId },
        select: { id: true, username: true, name: true },
    });
    if (!targetUser) {
        return NextResponse.json({ message: "Target user not found" }, { status: 404 });
    }

    const actorLabel = me.username || me.name || "Someone";
    const targetLabel = targetUser.username || targetUser.name || "a user";

    await db.$transaction([
        db.conversationParticipant.delete({ where: { id: targetRow.id } }),
        db.message.create({
            data: {
                conversationId: convoId,
                senderId: me.id,
                content: `[SYS] ${actorLabel} removed ${targetLabel} from the conversation.`,
            },
        }),
        db.conversation.update({ where: { id: convoId }, data: {} }),
    ]);

    // If < 2 participants remain, delete the conversation
    const remaining = await db.conversationParticipant.count({ where: { conversationId: convoId } });
    if (remaining < 2) {
        await db.$transaction([
            db.message.deleteMany({ where: { conversationId: convoId } }),
            db.conversation.delete({ where: { id: convoId } }),
        ]);
        return NextResponse.json({ ok: true, deleted: true, conversationId: convoId });
    }

    const participants = await db.conversationParticipant.findMany({
        where: { conversationId: convoId },
        include: { user: { select: { id: true, username: true, name: true, image: true } } },
        orderBy: { id: "asc" },
    });

    return NextResponse.json({
        ok: true,
        deleted: false,
        conversationId: convoId,
        participants: participants.map((p) => ({
            id: p.user.id,
            username: p.user.username,
            name: p.user.name,
            image: p.user.image,
        })),
    });
}
