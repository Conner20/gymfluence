import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
    _req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id: postId } = await context.params; // ✅ await params

    const comments = await db.comment.findMany({
        where: { postId, parentId: null },
        include: {
            author: true,
            replies: {
                include: {
                    author: true,
                    replies: { include: { author: true } },
                },
                orderBy: { createdAt: "asc" },
            },
        },
        orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(comments);
}

export async function POST(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id: postId } = await context.params; // ✅ await params

    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = await db.user.findUnique({
        where: { email: session.user.email },
    });
    if (!user)
        return NextResponse.json({ message: "User not found" }, { status: 404 });

    const { content, parentId } = await req.json();
    if (!content?.trim())
        return NextResponse.json({ message: "Empty comment" }, { status: 400 });

    const comment = await db.comment.create({
        data: {
            content,
            postId,
            authorId: user.id,
            parentId: parentId || null,
        },
    });

    return NextResponse.json(comment, { status: 201 });
}

export async function DELETE(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id: postId } = await context.params; // ✅ await params

    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = await db.user.findUnique({
        where: { email: session.user.email },
    });
    if (!user)
        return NextResponse.json({ message: "User not found" }, { status: 404 });

    const { commentId } = await req.json();
    if (!commentId) {
        return NextResponse.json(
            { message: "Missing commentId" },
            { status: 400 }
        );
    }

    const comment = await db.comment.findUnique({
        where: { id: commentId },
        select: { id: true, authorId: true, postId: true },
    });

    if (!comment || comment.postId !== postId) {
        return NextResponse.json(
            { message: "Comment not found" },
            { status: 404 }
        );
    }

    if (comment.authorId !== user.id) {
        return NextResponse.json(
            { message: "Forbidden: You can only delete your own comments." },
            { status: 403 }
        );
    }

    // Assuming cascading is handled in DB for replies; otherwise you'd delete children here too
    await db.comment.delete({ where: { id: commentId } });

    return NextResponse.json({ message: "Comment deleted" }, { status: 200 });
}
