// app/api/messages/search/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

/**
 * GET /api/messages/search?q=<string>
 * Returns up to 10 following users (ACCEPTED) whose username or name matches q.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

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

    if (q.length < 2) {
        return NextResponse.json({ followers: [] });
    }

    const matches = await db.follow.findMany({
        where: {
            followerId: me.id,
            status: "ACCEPTED",
            following: {
                OR: [
                    { username: { contains: q, mode: "insensitive" } },
                    { name: { contains: q, mode: "insensitive" } },
                ],
            },
        },
        include: {
            following: { select: { id: true, username: true, name: true, image: true } },
        },
        take: 10,
    });

    const followers = matches
        .map((f) => f.following)
        .filter((u) => u.id !== me.id);

    return NextResponse.json({ followers });
}
