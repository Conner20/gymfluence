import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: commentId } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });

    if (!user) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const content = String(body?.content || "").trim();
    if (!content) {
        return NextResponse.json({ message: "Comment cannot be empty." }, { status: 400 });
    }

    const comment = await db.comment.findUnique({
        where: { id: commentId },
        select: { id: true, authorId: true, postId: true },
    });

    if (!comment) {
        return NextResponse.json({ message: "Comment not found" }, { status: 404 });
    }

    if (comment.authorId !== user.id) {
        return NextResponse.json(
            { message: "Forbidden: You can only edit your own comments." },
            { status: 403 }
        );
    }

    const updated = await db.comment.update({
        where: { id: commentId },
        data: { content },
        select: {
            id: true,
            content: true,
            createdAt: true,
            postId: true,
            parentId: true,
        },
    });

    revalidateTag("posts");
    return NextResponse.json({ comment: updated }, { status: 200 });
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    // Next.js 15: params is a Promise
    const { id: commentId } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Find the current user
    const user = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });

    if (!user) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Find the comment to ensure it exists and belongs to this user
    const comment = await db.comment.findUnique({
        where: { id: commentId },
        select: { id: true, authorId: true, postId: true },
    });

    if (!comment) {
        return NextResponse.json({ message: "Comment not found" }, { status: 404 });
    }

    // Only allow the author of the comment to delete it
    if (comment.authorId !== user.id) {
        return NextResponse.json(
            { message: "Forbidden: You can only delete your own comments." },
            { status: 403 }
        );
    }

    // Delete the comment. If your Prisma schema uses ON DELETE CASCADE
    // on the parentId relation, replies will be removed automatically.
    await db.comment.delete({
        where: { id: commentId },
    });

    const commentCount = comment.postId
        ? await db.comment.count({ where: { postId: comment.postId } })
        : undefined;
    revalidateTag("posts");

    return NextResponse.json(
        { message: "Comment deleted.", commentCount },
        { status: 200 }
    );
}
