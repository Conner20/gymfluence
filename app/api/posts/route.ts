import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Create a new post
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { title, content } = await req.json();
    if (!title || !content) {
        return NextResponse.json({ message: "Title and content are required." }, { status: 400 });
    }

    const user = await db.user.findUnique({
        where: { email: session.user.email }
    });

    if (!user) {
        return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    try {
        const newPost = await db.post.create({
            data: {
                title,
                content,
                authorId: user.id,
            },
        });
        return NextResponse.json({ post: newPost, message: "Post created!" }, { status: 201 });
    } catch (error) {
        console.error("POST /api/posts error:", error);
        return NextResponse.json({ message: "Failed to create post." }, { status: 500 });
    }
}

// Fetch posts with privacy rules:
// - Public authors: visible to everyone
// - Private authors: visible only to their followers
// - The signed-in user always sees their own posts (regardless of privacy)
export async function GET(_req: Request) {
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
        // If we have a viewer, collect the list of authors they follow (ACCEPTED).
        let followedIds: string[] = [];
        if (currentUserId) {
            const following = await db.follow.findMany({
                where: { followerId: currentUserId, status: "ACCEPTED" },
                select: { followingId: true },
            });
            followedIds = following.map(f => f.followingId);
        }

        // Build the privacy filter:
        // - public authors
        // - authors the viewer follows (if signed in)
        // - the viewer themselves (so they always see their own posts)
        const whereFilter = {
            OR: [
                { author: { isPrivate: false } },
                ...(currentUserId ? [{ authorId: { in: followedIds } }] : []),
                ...(currentUserId ? [{ authorId: currentUserId }] : []),
            ],
        };

        const posts = await db.post.findMany({
            where: whereFilter,
            orderBy: { createdAt: "desc" },
            include: {
                author: true,
                likes: true,
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

        const formatted = posts.map(post => ({
            id: post.id,
            title: post.title,
            content: post.content,
            createdAt: post.createdAt,
            author: {
                id: post.author?.id ?? "",
                username: post.author?.username ?? null,
                name: post.author?.name ?? null,
                image: post.author?.image ?? null,
                isPrivate: !!post.author?.isPrivate,
            },
            likeCount: post.likes.length,
            didLike: currentUserId
                ? post.likes.some(like => like.userId === currentUserId)
                : false,
            commentCount:
                post.comments.length +
                post.comments.reduce((sum, c) => sum + (c.replies?.length ?? 0), 0),
            comments: post.comments.map(comment => ({
                id: comment.id,
                content: comment.content,
                createdAt: comment.createdAt,
                author: {
                    username: comment.author?.username ?? null,
                    email: comment.author?.email ?? null,
                },
                replies: comment.replies.map(reply => ({
                    id: reply.id,
                    content: reply.content,
                    createdAt: reply.createdAt,
                    author: {
                        username: reply.author?.username ?? null,
                        email: reply.author?.email ?? null,
                    },
                })),
            })),
        }));

        return NextResponse.json(formatted);
    } catch (error) {
        console.error("GET /api/posts error:", error);
        return NextResponse.json({ message: "Failed to fetch posts." }, { status: 500 });
    }
}

// Delete a post
export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await req.json();

    const post = await db.post.findUnique({
        where: { id },
        include: { author: true },
    });

    if (!post) {
        return NextResponse.json({ message: "Post not found." }, { status: 404 });
    }

    if (post.author?.email !== session.user.email) {
        return NextResponse.json({ message: "Forbidden: You can only delete your own posts." }, { status: 403 });
    }

    await db.post.delete({ where: { id } });

    return NextResponse.json({ message: "Post deleted." }, { status: 200 });
}
