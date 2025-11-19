import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
    _req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params; // ✅ await params

    const session = await getServerSession(authOptions);
    const viewerEmail = session?.user?.email ?? null;

    let viewerId: string | null = null;
    if (viewerEmail) {
        const me = await db.user.findUnique({
            where: { email: viewerEmail },
            select: { id: true },
        });
        viewerId = me?.id ?? null;
    }

    const post = await db.post.findUnique({
        where: { id },
        include: {
            author: {
                select: { id: true, username: true, name: true, isPrivate: true },
            },
            likes: { select: { userId: true } },
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
        return NextResponse.json({ message: "Post not found." }, { status: 404 });
    }

    // Privacy gate: private author & viewer is not author & not an accepted follower
    if (post.author.isPrivate && viewerId !== post.author.id) {
        const ok = viewerId
            ? await db.follow.findFirst({
                where: {
                    followerId: viewerId,
                    followingId: post.author.id,
                    status: "ACCEPTED",
                },
            })
            : null;

        if (!ok) {
            // 404 to mirror home feed behavior + give caller a hint to show CTA
            return NextResponse.json(
                {
                    message: "This post is private.",
                    author: { id: post.author.id, username: post.author.username },
                },
                { status: 404 }
            );
        }
    }

    const payload = {
        id: post.id,
        title: post.title,
        content: post.content,
        imageUrl: post.imageUrl ?? null,
        createdAt: post.createdAt,
        author: {
            id: post.author.id,
            username: post.author.username,
            name: post.author.name,
        },
        likeCount: post.likes.length,
        didLike: viewerId
            ? post.likes.some((l: typeof post.likes[number]) => l.userId === viewerId)
            : false,
        commentCount:
            post.comments.length +
            post.comments.reduce(
                (s: number, c: typeof post.comments[number]) => s + (c.replies?.length ?? 0),
                0
            ),
        comments: post.comments.map((c: typeof post.comments[number]) => ({
            id: c.id,
            content: c.content,
            createdAt: c.createdAt,
            author: {
                username: c.author?.username ?? null,
                email: c.author?.email ?? null,
            },
            replies: c.replies.map((r: typeof c.replies[number]) => ({
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
