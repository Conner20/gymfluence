import { NextResponse } from "next/server";
import { db } from "@/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
        select: { id: true, authorId: true },
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

    return NextResponse.json({ message: "Comment deleted." }, { status: 200 });
}
