// app/api/posts/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

// GET /api/posts/:id  → return one post if viewer is allowed to see it
export async function GET(_req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);

    let viewerId: string | null = null;
    if (session?.user?.email) {
        const me = await db.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        viewerId = me?.id ?? null;
    }

    const post = await db.post.findUnique({
        where: { id: params.id },
        include: {
            author: {
                select: {
                    id: true,
                    username: true,
                    name: true,
                    image: true,
                    isPrivate: true,
                },
            },
            likes: { select: { id: true, userId: true } },
            comments: {
                where: { parentId: null },
                orderBy: { createdAt: "asc" },
                include: {
                    author: { select: { username: true, email: true } },
                    replies: {
                        orderBy: { createdAt: "asc" },
                        include: { author: { select: { username: true, email: true } } },
                    },
                },
            },
        },
    });

    if (!post) {
        return NextResponse.json({ message: "Post not found" }, { status: 404 });
    }

    // Privacy rule: author public OR viewer is author OR viewer follows with ACCEPTED
    let canView = !post.author.isPrivate || viewerId === post.author.id;

    if (!canView && viewerId) {
        const rel = await db.follow.findFirst({
            where: {
                followerId: viewerId,
                followingId: post.author.id,
                status: "ACCEPTED",
            },
            select: { id: true },
        });
        canView = !!rel;
    }

    if (!canView) {
        return NextResponse.json({ message: "This post is private." }, { status: 403 });
    }

    const payload = {
        id: post.id,
        title: post.title,
        content: post.content,
        imageUrl: post.imageUrl ?? null,
        createdAt: post.createdAt,
        author: {
            id: post.author.id,
            username: post.author.username ?? null,
            name: post.author.name ?? null,
            image: post.author.image ?? null,
            isPrivate: !!post.author.isPrivate,
        },
        likeCount: post.likes.length,
        didLike: !!(viewerId && post.likes.some((l) => l.userId === viewerId)),
        commentCount:
            post.comments.length +
            post.comments.reduce((sum, c) => sum + (c.replies?.length ?? 0), 0),
        comments: post.comments.map((c) => ({
            id: c.id,
            content: c.content,
            createdAt: c.createdAt,
            author: {
                username: c.author?.username ?? null,
                email: c.author?.email ?? null,
            },
            replies: c.replies.map((r) => ({
                id: r.id,
                content: r.content,
                createdAt: r.createdAt,
                author: {
                    username: r.author?.username ?? null,
                    email: r.author?.email ?? null,
                },
            })),
        })),
    };

    return NextResponse.json(payload);
}
