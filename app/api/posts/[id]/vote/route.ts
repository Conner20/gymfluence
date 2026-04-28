import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { buildPollPayload } from "@/lib/postPoll";
import { db } from "@/prisma/client";

export async function POST(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id: postId } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });

    if (!user) {
        return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const optionId = String(body?.optionId || "").trim();
    if (!optionId) {
        return NextResponse.json({ message: "Poll option is required." }, { status: 400 });
    }

    const post = await db.post.findUnique({
        where: { id: postId },
        select: {
            id: true,
            type: true,
            pollQuestion: true,
            pollOptions: {
                orderBy: { order: "asc" },
                include: { votes: { select: { userId: true } } },
            },
        },
    });

    if (!post || post.type !== "POLL" || !post.pollQuestion) {
        return NextResponse.json({ message: "Poll not found." }, { status: 404 });
    }

    const optionExists = post.pollOptions.some((option) => option.id === optionId);
    if (!optionExists) {
        return NextResponse.json({ message: "Poll option not found." }, { status: 404 });
    }

    const existingVote = await db.pollVote.findUnique({
        where: {
            postId_userId: {
                postId,
                userId: user.id,
            },
        },
        select: { id: true },
    });

    if (!existingVote) {
        await db.pollVote.create({
            data: {
                postId,
                optionId,
                userId: user.id,
            },
        });
    }

    const refreshedPost = await db.post.findUnique({
        where: { id: postId },
        select: {
            pollQuestion: true,
            pollOptions: {
                orderBy: { order: "asc" },
                include: { votes: { select: { userId: true } } },
            },
        },
    });

    if (!refreshedPost?.pollQuestion) {
        return NextResponse.json({ message: "Poll not found." }, { status: 404 });
    }

    return NextResponse.json({
        poll: buildPollPayload({
            question: refreshedPost.pollQuestion,
            options: refreshedPost.pollOptions,
            viewerId: user.id,
        }),
    });
}
