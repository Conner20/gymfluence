import { db } from "@/prisma/client";
import { extractMentionUsernames } from "@/lib/mentions";

export async function createPostMentionNotifications({
    actorId,
    postId,
    title,
    content,
}: {
    actorId: string;
    postId: string;
    title: string;
    content: string;
}) {
    const usernames = extractMentionUsernames(title, content);
    if (!usernames.length) return;

    const mentionedUsers = await db.user.findMany({
        where: {
            id: { not: actorId },
            username: { in: usernames },
        },
        select: { id: true },
    });
    if (!mentionedUsers.length) return;

    await db.notification.createMany({
        data: mentionedUsers.map((user) => ({
            type: "TAGGED_IN_POST",
            userId: user.id,
            actorId,
            postId,
        })),
    });
}

export async function createCommentMentionNotifications({
    actorId,
    postId,
    commentId,
    content,
}: {
    actorId: string;
    postId: string;
    commentId: string;
    content: string;
}) {
    const usernames = extractMentionUsernames(content);
    if (!usernames.length) return;

    const mentionedUsers = await db.user.findMany({
        where: {
            id: { not: actorId },
            username: { in: usernames },
        },
        select: { id: true },
    });
    if (!mentionedUsers.length) return;

    await db.notification.createMany({
        data: mentionedUsers.map((user) => ({
            type: "TAGGED_IN_COMMENT",
            userId: user.id,
            actorId,
            postId,
            commentId,
        })),
    });
}
