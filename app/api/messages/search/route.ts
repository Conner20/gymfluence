// app/api/messages/search/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

/**
 * GET /api/messages/search?q=...
 * Returns people you FOLLOW or who FOLLOW you (ACCEPTED),
 * filtered by username/name contains `q` (case-insensitive).
 */
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    const meEmail = session?.user?.email ?? undefined;
    const meIdFromSession = (session?.user as any)?.id as string | undefined;
    if (!meEmail && !meIdFromSession) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const me = await db.user.findFirst({
        where: meIdFromSession ? { id: meIdFromSession } : { email: meEmail! },
        select: { id: true },
    });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (q.length < 2) {
        return NextResponse.json({ followers: [] });
    }

    // Collect IDs of people I follow and people who follow me (ACCEPTED)
    const [followingRows, followersRows] = await Promise.all([
        db.follow.findMany({
            where: { followerId: me.id, status: "ACCEPTED" },
            select: { followingId: true },
        }),
        db.follow.findMany({
            where: { followingId: me.id, status: "ACCEPTED" },
            select: { followerId: true },
        }),
    ]);

    const idSet = new Set<string>();
    for (const r of followingRows) idSet.add(r.followingId);
    for (const r of followersRows) idSet.add(r.followerId);

    if (idSet.size === 0) return NextResponse.json({ followers: [] });

    const results = await db.user.findMany({
        where: {
            id: { in: Array.from(idSet) },
            OR: [
                { username: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
            ],
        },
        select: { id: true, username: true, name: true, image: true },
        take: 50,
    });

    return NextResponse.json({ followers: results });
}
