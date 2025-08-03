import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { title, content } = await req.json();

    if (!title || !content) {
        return NextResponse.json({ message: "Title and content are required." }, { status: 400 });
    }

    // Get the user's ID from email
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
