"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

import { formatRelativeTime } from "@/lib/utils";
import { useLiveRefresh } from "@/app/hooks/useLiveRefresh";

type Notification = {
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
    isRead: boolean;
    createdAt: string;
    href: string;
    body: string;
    postTitle?: string;
    postHref?: string;
    ratingCount?: number;
    groupedNotificationIds?: string[];
    actionable?: boolean;
    followId?: string | null;
    actor: {
        id: string;
        username: string | null;
        name: string | null;
        image?: string | null;
    };
};

export default function NotificationsModal({
    open,
    onClose,
    onAnyChange,
    seenAt,
}: {
    open: boolean;
    onClose: () => void;
    onAnyChange?: () => void;
    seenAt?: number;
}) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<Notification[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [actingId, setActingId] = useState<string | null>(null);

    const load = async (silent = false) => {
        if (!open) return;
        if (!silent) setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/user/notifications", { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to load notifications");
            const data = await res.json();
            setItems(Array.isArray(data) ? data : []);
        } catch (e: any) {
            setError(e?.message || "Failed to fetch notifications");
            setItems([]);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        if (open) load();
    }, [open]);

    useLiveRefresh(() => load(true), { enabled: open, interval: 5000 });

    const respond = async (notificationId: string, action: "accept" | "decline") => {
        try {
            setActingId(notificationId);
            setError(null);

            const res = await fetch(`/api/user/notifications/${notificationId}/respond`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });

            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                throw new Error(txt || "Failed to respond");
            }

            setItems((prev) => prev.filter((n) => n.id !== notificationId));
            onAnyChange?.();
        } catch (e: any) {
            setError(e?.message || "Failed to respond to request");
        } finally {
            setActingId(null);
        }
    };

    const dismissNotification = async (notificationIds: string[]) => {
        try {
            setError(null);
            await Promise.all(
                notificationIds.map(async (notificationId) => {
                    const res = await fetch(`/api/user/notifications/${notificationId}`, {
                        method: "DELETE",
                    });
                    if (!res.ok) {
                        throw new Error("Failed to dismiss notification");
                    }
                }),
            );

            setItems((prev) => prev.filter((item) => !notificationIds.includes(item.id)));
            onAnyChange?.();
        } catch (e: any) {
            setError(e?.message || "Failed to dismiss notification");
        }
    };

    if (!open) return null;

    const ratingItems = items.filter((item) => item.type === "RATING");
    const ratingCount = ratingItems.length;
    const latestRating = ratingItems
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    const displayItems = items
        .filter((item) => item.type !== "RATING")
        .concat(
            ratingCount > 0 && latestRating
                ? [
                      {
                          ...latestRating,
                          id: "rating-summary",
                          ratingCount,
                          groupedNotificationIds: ratingItems.map((item) => item.id),
                      },
                  ]
                : [],
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 dark:bg-black/70">
            <div className="max-h-[80vh] w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-neutral-900 dark:text-gray-100">
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Notifications</h3>
                    <button className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-white/10" onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                <div className="mb-3 flex items-center justify-between">
                    <button
                        onClick={() => load()}
                        className="rounded-full border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-white/20 dark:bg-transparent dark:text-gray-100 dark:hover:bg-white/10"
                        disabled={loading}
                    >
                        Refresh
                    </button>
                    {loading && <span className="text-xs text-gray-500 dark:text-gray-400">Loading…</span>}
                </div>

                {error && <div className="mb-3 text-sm text-red-500">{error}</div>}

                {displayItems.length === 0 ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400">No notifications.</div>
                ) : (
                    <ul className="scrollbar-slim max-h-[62vh] divide-y overflow-y-auto pr-1 dark:divide-white/10">
                        {displayItems.map((n) => {
                            const actorName = n.actor?.username || n.actor?.name || "User";
                            const disabled = actingId === n.id;
                            const isFollowRequest = n.type === "FOLLOW_REQUEST";
                            const isMessage = n.type === "MESSAGE";
                            const isRatingSummary = n.type === "RATING" && typeof n.ratingCount === "number";
                            const actorHref = n.actor?.username ? `/u/${encodeURIComponent(n.actor.username)}` : n.href;

                            return (
                                <li key={n.id} className="py-3">
                                    <div className={isRatingSummary ? "flex items-center" : "flex items-center gap-3"}>
                                        {!isRatingSummary && n.actor?.image ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={n.actor.image}
                                                alt={actorName}
                                                className="h-10 w-10 rounded-full object-cover"
                                            />
                                        ) : !isRatingSummary ? (
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xs dark:bg-white/10">
                                                {actorName.slice(0, 2)}
                                            </div>
                                        ) : null}

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-3">
                                                <div className="min-w-0 flex-1 text-sm text-zinc-900 dark:text-white">
                                                    {isRatingSummary ? (
                                                        <span className="text-zinc-600 dark:text-zinc-300">
                                                            You received{" "}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    onClose();
                                                                    router.push(n.href);
                                                                }}
                                                                className="font-semibold text-zinc-900 hover:underline dark:text-white"
                                                            >
                                                                {n.ratingCount}
                                                            </button>{" "}
                                                            rating{n.ratingCount === 1 ? "" : "s"}
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    onClose();
                                                                    router.push(actorHref);
                                                                }}
                                                                className="font-medium hover:underline"
                                                            >
                                                                {actorName}
                                                            </button>
                                                            <span className="ml-1 text-zinc-600 dark:text-zinc-300">
                                                                {isMessage ? "sent you a" : n.body}
                                                            </span>
                                                        </>
                                                    )}
                                                    {isMessage && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                onClose();
                                                                router.push(n.href);
                                                            }}
                                                            className="ml-1 font-semibold hover:underline"
                                                        >
                                                            message
                                                        </button>
                                                    )}
                                                    {n.postTitle && n.postHref && (
                                                        <>
                                                            <span className="text-zinc-600 dark:text-zinc-300"> </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    onClose();
                                                                    router.push(n.postHref!);
                                                                }}
                                                                className="font-semibold hover:underline"
                                                            >
                                                                {n.postTitle}
                                                            </button>
                                                        </>
                                                    )}
                                                    <div
                                                        className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 sm:text-xs"
                                                        title={new Date(n.createdAt).toLocaleString()}
                                                    >
                                                        {formatRelativeTime(n.createdAt)}
                                                    </div>
                                                </div>
                                                <div className="ml-auto flex shrink-0 items-center justify-end gap-1">
                                                    {isFollowRequest ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => respond(n.id, "accept")}
                                                                className="rounded-full p-1.5 text-green-600 transition hover:bg-green-50 hover:text-green-700 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-500/10 dark:hover:text-green-300"
                                                                aria-label="Accept follow request"
                                                                disabled={disabled}
                                                            >
                                                                {disabled ? <span className="px-[3px] text-xs">…</span> : <Check size={15} />}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => respond(n.id, "decline")}
                                                                className="rounded-full p-1.5 text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                                                                aria-label="Decline follow request"
                                                                disabled={disabled}
                                                            >
                                                                {disabled ? <span className="px-[3px] text-xs">…</span> : <X size={15} />}
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                dismissNotification(
                                                                    n.groupedNotificationIds?.length
                                                                        ? n.groupedNotificationIds
                                                                        : [n.id],
                                                                )
                                                            }
                                                            className="shrink-0 rounded-full p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-white"
                                                            aria-label="Dismiss notification"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
