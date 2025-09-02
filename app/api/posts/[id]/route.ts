// app/api/posts/[id]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/posts/:id
 * Returns a single post if visible to the viewer, with like counts and author info.
 * Visibility:
 *  - Public authors visible to everyone
 *  - Private authors visible only to accepted followers or the author themself
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email ?? null;

    let currentUserId: string | null = null;
    if (userEmail) {
        const me = await db.user.findUnique({
            where: { email: userEmail },
            select: { id: true },
        });
        currentUserId = me?.id ?? null;
    }

    try {
        // Fetch the post and everything we need to render + enforce visibility.
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
                likes: {
                    select: { userId: true },
                },
                comments: {
                    where: { parentId: null },
                    orderBy: { createdAt: "asc" },
                    include: {
                        author: true,
                        replies: {
                            orderBy: { createdAt: "asc" },
                            include: { author: true },
                        },
                    },
                },
            },
        });

        if (!post) {
            return NextResponse.json({ message: "Not found" }, { status: 404 });
        }

        // Enforce privacy: private authors only visible to accepted followers or the author themself.
        if (post.author?.isPrivate) {
            const isAuthor = currentUserId === post.author.id;

            let isAcceptedFollower = false;
            if (currentUserId && !isAuthor) {
                const follow = await db.follow.findFirst({
                    where: {
                        followerId: currentUserId,
                        followingId: post.author.id,
                        status: "ACCEPTED",
                    },
                    select: { id: true },
                });
                isAcceptedFollower = !!follow;
            }

            if (!isAuthor && !isAcceptedFollower) {
                // Hide existence/details of private post from non-followers
                return NextResponse.json({ message: "Not found" }, { status: 404 });
            }
        }

        const likeCount = post.likes.length;
        const didLike = currentUserId ? post.likes.some((l) => l.userId === currentUserId) : false;

        const formatted = {
            id: post.id,
            title: post.title,
            content: post.content,
            imageUrl: post.imageUrl ?? null,
            createdAt: post.createdAt,
            author: post.author
                ? {
                    id: post.author.id,
                    username: post.author.username ?? null,
                    name: post.author.name ?? null,
                }
                : null,
            likeCount,
            didLike,
            commentCount:
                post.comments.length + post.comments.reduce((sum, c) => sum + (c.replies?.length ?? 0), 0),
            comments: post.comments.map((comment) => ({
                id: comment.id,
                content: comment.content,
                createdAt: comment.createdAt,
                author: {
                    username: comment.author?.username ?? null,
                    email: comment.author?.email ?? null,
                },
                replies: comment.replies.map((reply) => ({
                    id: reply.id,
                    content: reply.content,
                    createdAt: reply.createdAt,
                    author: {
                        username: reply.author?.username ?? null,
                        email: reply.author?.email ?? null,
                    },
                })),
            })),
        };

        return NextResponse.json(formatted);
    } catch (error) {
        console.error("GET /api/posts/[id] error:", error);
        return NextResponse.json({ message: "Failed to fetch post." }, { status: 500 });
    }
}
