// app/api/conversations/route.ts
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

/** Find-or-create a DM using dmKey */
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
 * POST /api/conversations
 * Body: { userIds?: string[] }  // entries may be IDs or usernames
 *
 * Behavior:
 *  - If exactly 1 unique other user -> create/return a DM
 *  - If 2+ unique others -> create a group (no dmKey)
 *  - If there already exists a group with the EXACT same participant set (including you),
 *    return that existing conversation (do NOT create duplicate).
 *  - Overlapping sets are allowed (e.g., existing [me, A, D]; creating [me, A, B, D] is OK).
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

    const rawList: string[] = Array.isArray(body?.userIds) ? body.userIds.map(String) : [];
    if (rawList.length === 0) {
        return NextResponse.json({ message: "Select at least one other person." }, { status: 400 });
    }

    // Resolve every entry (id or username) -> userId
    const resolvedIds: string[] = [];
    for (const entry of rawList) {
        const uid = await resolveUserId(entry);
        if (uid) resolvedIds.push(uid);
    }

    // Deduplicate and exclude me
    const uniqueIds = Array.from(new Set(resolvedIds)).filter((id) => id && id !== me.id);

    if (uniqueIds.length === 0) {
        return NextResponse.json(
            { message: "Everyone selected was invalid or yourself. Pick at least one other person." },
            { status: 400 }
        );
    }

    // If 1 other => DM
    if (uniqueIds.length === 1) {
        const otherId = uniqueIds[0]!;
        const convo = await findOrCreateDM(me.id, otherId);
        return NextResponse.json({ conversationId: convo.id, isGroup: false, existed: true });
    }

    // If 2+ => GROUP
    // Ensure all users exist
    const found = await db.user.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
    });
    if (found.length !== uniqueIds.length) {
        return NextResponse.json({ message: "One or more selected users do not exist." }, { status: 400 });
    }

    // Exact-duplicate check:
    // desiredSet = me + all others (order-independent)
    const desiredSet = Array.from(new Set([me.id, ...uniqueIds]));
    // Find conversations where EVERY participant is in desiredSet,
    // and there are NO participants outside desiredSet (i.e., subset==superset),
    // then verify counts match exactly to ensure equality.
    const candidates = await db.conversation.findMany({
        where: {
            dmKey: null, // groups only
            participants: {
                every: { userId: { in: desiredSet } },
                none: { userId: { notIn: desiredSet } },
            },
        },
        select: { id: true, participants: { select: { userId: true } } },
    });

    const exact = candidates.find(
        (c: typeof candidates[number]) => c.participants.length === desiredSet.length
    );
    if (exact) {
        return NextResponse.json({ conversationId: exact.id, isGroup: true, existed: true });
    }

    // Create the new group
    const convo = await db.conversation.create({
        data: {
            participants: {
                create: [{ userId: me.id }, ...uniqueIds.map((id) => ({ userId: id }))],
            },
        },
        select: { id: true },
    });

    return NextResponse.json({ conversationId: convo.id, isGroup: true, existed: false });
}
