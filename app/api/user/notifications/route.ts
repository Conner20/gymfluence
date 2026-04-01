import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/prisma/client";

type LiteActor = {
    id: string;
    username: string | null;
    name: string | null;
    image: string | null;
};

type NotificationItem = {
    id: string;
    type:
        | "FOLLOW_REQUEST"
        | "FOLLOWED_YOU"
        | "REQUEST_ACCEPTED"
        | "MESSAGE"
        | "LIKE"
        | "COMMENT"
        | "RATING"
        | "DASHBOARD_SHARED";
    createdAt: string;
    actor: LiteActor;
    href: string;
    body: string;
    postTitle?: string;
    postHref?: string;
    isRead: boolean;
    followId?: string | null;
    actionable?: boolean;
};

const actorName = (actor: Pick<LiteActor, "username" | "name">) =>
    actor.username || actor.name || "User";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const me = await db.user.findUnique({
        where: { email: session.user.email.toLowerCase() },
        select: { id: true, role: true, notificationsSeenAt: true },
    });
    if (!me) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const dismissals = await db.notificationDismissal.findMany({
        where: { userId: me.id },
        select: { notificationId: true },
    });
    const dismissedIds = new Set(dismissals.map((dismissal) => dismissal.notificationId));

    const [
        followNotifications,
        likes,
        comments,
        shares,
        ratings,
        conversations,
    ] = await Promise.all([
        db.notification.findMany({
            where: { userId: me.id },
            orderBy: { createdAt: "desc" },
            include: {
                actor: { select: { id: true, username: true, name: true, image: true } },
                follow: {
                    select: {
                        id: true,
                        followerId: true,
                        followingId: true,
                        status: true,
                    },
                },
            },
            take: 20,
        }),
        db.like.findMany({
            where: {
                userId: { not: me.id },
                post: { authorId: me.id },
            },
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { id: true, username: true, name: true, image: true } },
                post: { select: { id: true, title: true } },
            },
            take: 20,
        }),
        db.comment.findMany({
            where: {
                authorId: { not: me.id },
                OR: [
                    { post: { authorId: me.id } },
                    { parent: { authorId: me.id } },
                ],
            },
            orderBy: { createdAt: "desc" },
            include: {
                author: { select: { id: true, username: true, name: true, image: true } },
                post: { select: { id: true, title: true } },
                parent: { select: { authorId: true } },
            },
            take: 20,
        }),
        db.dashboardShare.findMany({
            where: {
                viewerId: me.id,
                OR: [{ workouts: true }, { wellness: true }, { nutrition: true }],
            },
            orderBy: { createdAt: "desc" },
            include: {
                owner: { select: { id: true, username: true, name: true, image: true } },
            },
            take: 20,
        }),
        me.role === "TRAINER"
            ? db.rating.findMany({
                  where: {
                      raterId: { not: me.id },
                      status: { in: ["PENDING", "APPROVED"] },
                      trainer: { userId: me.id },
                  },
                  orderBy: { createdAt: "desc" },
                  include: {
                      rater: { select: { id: true, username: true, name: true, image: true } },
                  },
                  take: 20,
              })
            : me.role === "GYM"
              ? db.rating.findMany({
                    where: {
                        raterId: { not: me.id },
                        status: { in: ["PENDING", "APPROVED"] },
                        gym: { userId: me.id },
                    },
                    orderBy: { createdAt: "desc" },
                    include: {
                        rater: { select: { id: true, username: true, name: true, image: true } },
                    },
                    take: 20,
                })
              : Promise.resolve([]),
        db.conversation.findMany({
            where: {
                participants: { some: { userId: me.id } },
                messages: {
                    some: {
                        senderId: { not: me.id },
                        readAt: null,
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
            include: {
                messages: {
                    where: {
                        senderId: { not: me.id },
                        readAt: null,
                    },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    include: {
                        sender: { select: { id: true, username: true, name: true, image: true } },
                    },
                },
            },
            take: 20,
        }),
    ]);

    const followItems: NotificationItem[] = followNotifications.map((n) => {
        const followStillExists =
            n.follow &&
            ((n.type === "FOLLOW_REQUEST" &&
                n.follow.followingId === me.id &&
                n.follow.status === "PENDING") ||
                (n.type === "FOLLOWED_YOU" &&
                    n.follow.followingId === me.id &&
                    n.follow.status === "ACCEPTED") ||
                (n.type === "REQUEST_ACCEPTED" &&
                    n.follow.followerId === me.id &&
                    n.follow.status === "ACCEPTED"));

        if (!followStillExists) return null;

        const name = actorName(n.actor);
        const href = n.actor.username ? `/u/${encodeURIComponent(n.actor.username)}` : "/search";
        return {
            id: n.id,
            type: n.type,
            createdAt: n.createdAt.toISOString(),
            actor: n.actor,
            href,
            body:
                n.type === "FOLLOW_REQUEST"
                    ? "requested to follow you"
                    : n.type === "FOLLOWED_YOU"
                      ? "started following you"
                      : "accepted your follow request",
            isRead: n.isRead,
            followId: n.followId,
            actionable: n.type === "FOLLOW_REQUEST",
        };
    }).filter(Boolean) as NotificationItem[];

    const likeItems: NotificationItem[] = likes.map((like) => {
        const postLabel = like.post.title?.trim() || "Untitled post";
        return {
            id: `like-${like.id}`,
            type: "LIKE",
            createdAt: like.createdAt.toISOString(),
            actor: like.user,
            href: `/post/${like.post.id}`,
            body: "liked your post",
            postTitle: postLabel,
            postHref: `/post/${like.post.id}`,
            isRead: false,
        };
    });

    const commentItems: NotificationItem[] = comments.map((comment) => {
        const postLabel = comment.post.title?.trim() || "Untitled post";
        const isReplyToMyComment = comment.parent?.authorId === me.id;
        return {
            id: `comment-${comment.id}`,
            type: "COMMENT",
            createdAt: comment.createdAt.toISOString(),
            actor: comment.author,
            href: `/post/${comment.post.id}`,
            body: isReplyToMyComment
                ? "replied to your comment on the post"
                : "commented on your post",
            postTitle: postLabel,
            postHref: `/post/${comment.post.id}`,
            isRead: false,
        };
    });

    const shareItems: NotificationItem[] = shares.map((share) => {
        const dashboards = [
            share.workouts ? "workouts" : null,
            share.wellness ? "wellness" : null,
            share.nutrition ? "nutrition" : null,
        ].filter(Boolean) as string[];
        const name = actorName(share.owner);
        return {
            id: `share-${share.id}`,
            type: "DASHBOARD_SHARED",
            createdAt: share.createdAt.toISOString(),
            actor: share.owner,
            href: share.workouts
                ? "/dashboard"
                : share.wellness
                  ? "/dashboard/wellness"
                  : "/dashboard/nutrition",
            body: `shared ${dashboards.join(", ")} dashboard${dashboards.length > 1 ? "s" : ""} with you.`,
            isRead: false,
        };
    });

    const ratingItems: NotificationItem[] = ratings.map((rating) => {
        const name = actorName(rating.rater);
        return {
            id: `rating-${rating.id}`,
            type: "RATING",
            createdAt: rating.createdAt.toISOString(),
            actor: rating.rater,
            href: "/profile?ratings=1",
            body: `left you a ${rating.stars}/5 rating${rating.comment ? `: ${rating.comment}` : "."}`,
            isRead: false,
        };
    });

    const messageItems: NotificationItem[] = await Promise.all(
        conversations.map(async (conversation) => {
            const latestUnread = conversation.messages[0];
            if (!latestUnread) return null;

            const unreadCount = await db.message.count({
                where: {
                    conversationId: conversation.id,
                    senderId: { not: me.id },
                    readAt: null,
                },
            });

            const sender = latestUnread.sender;
            const name = actorName(sender);
            const preview = latestUnread.content.trim()
                ? latestUnread.content.trim()
                : latestUnread.imageUrls.length
                  ? "Sent an image"
                  : "Sent a message";

            return {
                id: `message-${latestUnread.id}`,
                type: "MESSAGE",
                createdAt: latestUnread.createdAt.toISOString(),
                actor: sender,
                href: "/messages",
                body:
                    unreadCount > 1
                        ? `sent ${unreadCount} unread messages`
                        : "sent you a",
                isRead: false,
            } satisfies NotificationItem;
        }),
    ).then((items) => items.filter(Boolean) as NotificationItem[]);

    const items = [
        ...followItems,
        ...messageItems,
        ...commentItems,
        ...likeItems,
        ...shareItems,
        ...ratingItems,
    ]
        .filter((item) => !dismissedIds.has(item.id))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 50);

    return NextResponse.json({
        items,
        seenAt: me.notificationsSeenAt?.toISOString() ?? null,
    });
}

export async function POST() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const me = await db.user.update({
        where: { email: session.user.email.toLowerCase() },
        data: { notificationsSeenAt: now },
        select: { notificationsSeenAt: true },
    });

    return NextResponse.json({
        seenAt: me.notificationsSeenAt?.toISOString() ?? now.toISOString(),
    });
}
