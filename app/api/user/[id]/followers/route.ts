// app/api/user/[id]/followers/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id: userId } = await ctx.params;

    const session = await getServerSession(authOptions);
    const viewer = session?.user?.email
        ? await db.user.findUnique({ where: { email: session.user.email } })
        : null;

    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) return NextResponse.json([], { status: 200 });

    // enforce privacy
    if (target.isPrivate && viewer?.id !== userId) {
        const rel = viewer
            ? await db.follow.findUnique({
                where: { followerId_followingId: { followerId: viewer.id, followingId: userId } },
            })
            : null;
        const canSee = rel?.status === "ACCEPTED";
        if (!canSee) return NextResponse.json([], { status: 200 });
    }

    const rows = await db.follow.findMany({
        where: { followingId: userId, status: "ACCEPTED" },
        include: {
            follower: { select: { id: true, username: true, name: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    const users = rows.map((r) => r.follower);
    return NextResponse.json(users);
}
