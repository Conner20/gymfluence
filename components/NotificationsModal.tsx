"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

type Notification = {
    id: string;
    type: "FOLLOW_REQUEST" | "FOLLOWED_YOU" | "REQUEST_ACCEPTED";
    isRead: boolean;
    createdAt: string;
    actor: {
        id: string;
        username: string | null;
        name: string | null;
        image?: string | null;
    };
    followId?: string | null;
};

export default function NotificationsModal({
    open,
    onClose,
    onAnyChange, // optional: parent can refresh follow counts or state after accept/decline
}: {
    open: boolean;
    onClose: () => void;
    onAnyChange?: () => void;
}) {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<Notification[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [actingId, setActingId] = useState<string | null>(null);

    const load = async () => {
        if (!open) return;
        setLoading(true);
        setError(null);
        try {
            // 🔁 your notifications index route
            const res = await fetch("/api/user/notifications", { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to load notifications");
            const data = await res.json();
            setItems(Array.isArray(data) ? data : []);
        } catch (e: any) {
            setError(e?.message || "Failed to fetch notifications");
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const respond = async (notificationId: string, action: "accept" | "decline") => {
        try {
            setActingId(notificationId);
            setError(null);

            // ✅ hit your dynamic respond route: /api/user/notifications/[id]/respond
            const res = await fetch(`/api/user/notifications/${notificationId}/respond`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });

            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                throw new Error(txt || "Failed to respond");
            }

            // Optimistic remove from the list
            setItems((prev) => prev.filter((n) => n.id !== notificationId));
            onAnyChange?.(); // let parent refresh any counters/state if needed
        } catch (e: any) {
            setError(e?.message || "Failed to respond to request");
        } finally {
            setActingId(null);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center dark:bg-black/70">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-4 dark:bg-neutral-900 dark:text-gray-100 dark:border dark:border-white/10">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Notifications</h3>
                    <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10" onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex items-center justify-between mb-3">
                    <button
                        onClick={load}
                        className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-sm dark:bg-transparent dark:border-white/20 dark:text-gray-100 dark:hover:bg-white/10"
                        disabled={loading}
                    >
                        Refresh
                    </button>
                    {loading && <span className="text-xs text-gray-500 dark:text-gray-400">Loading…</span>}
                </div>

                {error && <div className="text-sm text-red-500 mb-3">{error}</div>}

                {items.length === 0 ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400">No notifications.</div>
                ) : (
                    <ul className="divide-y dark:divide-white/10">
                        {items.map((n) => {
                            const actorName = n.actor?.username || n.actor?.name || "User";
                            const isFollowRequest = n.type === "FOLLOW_REQUEST";
                            const disabled = actingId === n.id;

                            return (
                                <li key={n.id} className="py-3 flex items-center gap-3">
                                    {n.actor?.image ? (
                                        <img
                                            src={n.actor.image}
                                            alt={actorName}
                                            className="w-9 h-9 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs dark:bg-white/10">
                                            {actorName.slice(0, 2)}
                                        </div>
                                    )}

                                    <div className="flex-1 min-w-0">
                                        {isFollowRequest ? (
                                            <div className="text-sm">
                                                <span className="font-medium">{actorName}</span> requested to follow you.
                                            </div>
                                        ) : n.type === "FOLLOWED_YOU" ? (
                                            <div className="text-sm">
                                                <span className="font-medium">{actorName}</span> followed you.
                                            </div>
                                        ) : (
                                            <div className="text-sm">
                                                Your follow request to <span className="font-medium">{actorName}</span> was
                                                accepted.
                                            </div>
                                        )}
                                        <div
                                            className="text-xs text-gray-500 dark:text-gray-400"
                                            title={new Date(n.createdAt).toLocaleString()}
                                        >
                                            {formatRelativeTime(n.createdAt)}
                                        </div>
                                    </div>

                                    {isFollowRequest ? (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => respond(n.id, "accept")}
                                                className="px-2.5 py-1 rounded-md bg-green-600 text-white text-xs hover:bg-green-700 disabled:opacity-50"
                                                disabled={disabled}
                                            >
                                                {disabled ? "…" : "Accept"}
                                            </button>
                                            <button
                                                onClick={() => respond(n.id, "decline")}
                                                className="px-2.5 py-1 rounded-md bg-gray-200 text-xs hover:bg-gray-300 disabled:opacity-50"
                                                disabled={disabled}
                                            >
                                                {disabled ? "…" : "Decline"}
                                            </button>
                                        </div>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
