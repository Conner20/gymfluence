import { NextResponse } from "next/server";
import { db } from "@/prisma/client";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

    const user = await db.user.findUnique({
        where: { email },
        include: {
            traineeProfile: true,
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

    const posts = postsRaw.map((p) => ({
        ...p,
        likeCount: p.likes.length,
        commentCount:
            p.comments.length +
            p.comments.reduce((s, c) => s + (c.replies?.length ?? 0), 0),
    }));

    return NextResponse.json({ user, posts });
}
