import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    console.log("Session:", session);

    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { title, content } = await req.json();
    console.log("Received title:", title, "content:", content);

    if (!title || !content) {
        return NextResponse.json({ message: "Title and content are required." }, { status: 400 });
    }

    const user = await db.user.findUnique({
        where: { email: session.user.email }
    });

    console.log("User found:", user);

    if (!user) {
        return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    console.log("DB Models:", Object.keys(db));

    try {
        const newPost = await db.post.create({
            data: {
                title,
                content,
                authorId: user.id,
            },
        });

        console.log("Post created:", newPost);

        return NextResponse.json({ post: newPost, message: "Post created!" }, { status: 201 });
    } catch (error) {
        console.error("POST /api/posts error:", error);
        return NextResponse.json({ message: "Failed to create post." }, { status: 500 });
    }
}

export async function GET(req: Request) {
    // Get current user session for personalized info (did the user like this post?)
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email ?? null;
    let currentUserId: string | null = null;

    if (userEmail) {
        const user = await db.user.findUnique({ where: { email: userEmail } });
        currentUserId = user?.id ?? null;
    }

    try {
        // Include likes in the response
        const posts = await db.post.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                author: true,
                likes: true,
            },
        });

        // Format posts: add like count and didLike (for this user)
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
        }));

        return NextResponse.json(formatted);
    } catch (error) {
        return NextResponse.json({ message: "Failed to fetch posts." }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await req.json();

    // Find the post first
    const post = await db.post.findUnique({
        where: { id },
        include: { author: true },
    });

    if (!post) {
        return NextResponse.json({ message: "Post not found." }, { status: 404 });
    }

    // Only allow deleting if the post belongs to the current user
    if (post.author?.email !== session.user.email) {
        return NextResponse.json({ message: "Forbidden: You can only delete your own posts." }, { status: 403 });
    }

    await db.post.delete({ where: { id } });

    return NextResponse.json({ message: "Post deleted." }, { status: 200 });
}