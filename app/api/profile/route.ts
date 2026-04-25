import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const session = await getServerSession(authOptions);
    const email = searchParams.get("email") ?? session?.user?.email ?? null;
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await db.user.findUnique({
        where: { email: email.toLowerCase() },
        include: {
            traineeProfile: {
                include: {
                    associatedTrainer: {
                        select: { id: true, username: true, name: true },
                    },
                },
            },
            trainerProfile: true,
            gymProfile: true,
        }
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Fetch posts for media grid
    const postsRaw = await db.post.findMany({
        where: { authorId: user.id },
        orderBy: { createdAt: "desc" },
        include: {
            likes: { select: { userId: true } },
            comments: {
                where: { parentId: null },
                include: {
                    replies: true,
                },
            },
        },
    });

    const posts = postsRaw.map((p: typeof postsRaw[number]) => ({
        ...p,
        likeCount: p.likes.length,
        commentCount:
            p.comments.length +
            p.comments.reduce(
                (s: number, c: typeof p.comments[number]) => s + (c.replies?.length ?? 0),
                0
            ),
    }));

    return NextResponse.json({ user, posts });
}
