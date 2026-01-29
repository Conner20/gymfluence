// app/api/user/[id]/posts/route.ts
import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env";

const isAdminEmail = (email: string | null | undefined) => {
    if (!email) return false;
    return env.ADMIN_EMAILS.split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
        .includes(email.toLowerCase());
};

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: userId } = await params;

    const session = await getServerSession(authOptions);
    const viewer = session?.user?.email
        ? await db.user.findUnique({ where: { email: session.user.email } })
        : null;

    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) return NextResponse.json([], { status: 200 });

    const viewerId = viewer?.id ?? null;
    const isOwner = viewerId === userId;
    const isAdmin = isAdminEmail(session?.user?.email ?? null);

    if (target.isPrivate && !isOwner && !isAdmin) {
        const rel = await db.follow.findUnique({
            where: {
                followerId_followingId: {
                    followerId: viewerId ?? "",
                    followingId: userId,
                },
            },
            select: { status: true },
        });
        if (rel?.status !== "ACCEPTED") {
            return NextResponse.json({ message: "Private account" }, { status: 403 });
        }
    }

    const posts = await db.post.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, imageUrl: true },
    });

    return NextResponse.json(posts);
}
