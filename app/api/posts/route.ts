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

// Fetch all posts (with likes, didLike, comment count, and nested comments/replies)
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email ?? null;
    let currentUserId: string | null = null;

    if (userEmail) {
        const user = await db.user.findUnique({ where: { email: userEmail } });
        currentUserId = user?.id ?? null;
    }

    try {
        // Include comments and their replies, and author info for each
        const posts = await db.post.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                author: true,
                likes: true,
                comments: {
                    where: { parentId: null }, // Only top-level comments
                    orderBy: { createdAt: "asc" },
                    include: {
                        author: true,
                        replies: {
                            orderBy: { createdAt: "asc" },
                            include: {
                                author: true,
                            }
                        }
                    }
                }
            },
        });

        const formatted = posts.map(post => ({
            id: post.id,
            title: post.title,
            content: post.content,
            createdAt: post.createdAt,
            author: {
                username: post.author?.username ?? null,
                email: post.author?.email ?? null,
            },
            likeCount: post.likes.length,
            didLike: currentUserId
                ? post.likes.some(like => like.userId === currentUserId)
                : false,
            commentCount: post.comments.length +
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
                }))
            }))
        }));

        return NextResponse.json(formatted);
    } catch (error) {
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
