"use client";

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    UserPlus,
    UserMinus,
    MessageSquare,
    Share2,
    Bell,
    Link as LinkIcon,
    Lock,
    ArrowLeft,
    Heart,
    MessageCircle,
    Pencil,
    UserPen,
    Star,
    X,
    Trash2,
    MapPin,
    Search,
} from "lucide-react";
import { useFollow } from "@/app/hooks/useFollow";
import FollowListModal from "@/components/FollowListModal";
import NotificationsModal from "@/components/NotificationsModal";
import CreatePost from "@/components/CreatePost";
import clsx from "clsx";
import PostDetail from "@/components/PostDetail";
import { PostComments } from "@/components/PostComments";
import { EditPostDialog } from "@/components/ui/edit-content-dialog";
import { formatRelativeTime } from "@/lib/utils";
import { useLiveRefresh } from "@/app/hooks/useLiveRefresh";
import { getPostImageUrls } from "@/lib/postImages";
import PostImageCarousel from "@/components/PostImageCarousel";

/* --------------------------- helpers & local UI --------------------------- */

async function postJSON<T>(url: string, payload: any): Promise<T> {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
    return data as T;
}
async function patchJSON<T>(url: string, payload: any): Promise<T> {
    const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
    return data as T;
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
    return (
        <div className="inline-flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
                <button
                    key={n}
                    type="button"
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onClick={() => onChange(n)}
                    className="text-2xl leading-none"
                    style={{ background: "transparent" }}
                >
                    {n <= value ? "★" : "☆"}
                </button>
            ))}
        </div>
    );
}

function RateTrainerModal({
    open,
    onClose,
    trainerId,
    onSuccess,
}: {
    open: boolean;
    onClose: () => void;
    trainerId?: string;
    onSuccess?: () => void;
}) {
    const [stars, setStars] = React.useState(5);
    const [comment, setComment] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState<string | null>(null);

    if (!open) return null;

    async function submit() {
        if (!trainerId) return;
        setBusy(true);
        setErr(null);
        try {
            await postJSON("/api/ratings", {
                trainerId,
                gymId: null,
                stars,
                comment: comment.trim() || null,
            });
            onSuccess?.();
            onClose();
        } catch (e: any) {
            setErr(e.message || "Failed to submit rating");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-[999] bg-black/50 dark:bg-black/80 flex items-center justify-center px-4"
            role="dialog"
            aria-modal
        >
            <div className="bg-white rounded-xl p-5 w-full max-w-md shadow-xl dark:bg-neutral-900 dark:text-gray-100 dark:border dark:border-white/10 dark:shadow-none">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Rate this trainer</h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 dark:text-gray-300"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>
                <div className="mt-4 text-2xl">
                    <StarPicker value={stars} onChange={setStars} />
                </div>
                <textarea
                    className="w-full mt-4 p-3 border rounded bg-white text-gray-800 placeholder:text-gray-500 dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:placeholder:text-gray-500"
                    rows={4}
                    placeholder="Optional comment…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                />
                {err && <p className="mt-2 text-red-500 dark:text-red-400">{err}</p>}
                <div className="mt-4 flex gap-2 justify-end">
                    <button
                        onClick={onClose}
                        className="px-3 py-2 rounded border text-gray-700 hover:bg-gray-50 dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={busy}
                        className="px-3 py-2 rounded bg-black text-white disabled:opacity-50 dark:bg-white dark:text-black"
                    >
                        {busy ? "Submitting…" : "Submit"}
                    </button>
                </div>
            </div>
        </div>
    );
}

type PendingLite = {
    id: string;
    createdAt: string;
    rater?: { username: string | null; name: string | null } | null;
};
type HistoryRow = {
    id: string;
    createdAt: string;
    stars: number;
    comment: string | null;
    rater?: { username: string | null; name: string | null } | null;
};

function ManageTrainerRatingsModal({
    open,
    onClose,
    onApproved,
}: {
    open: boolean;
    onClose: () => void;
    onApproved?: (v: { newAverage: number; clients: number }) => void;
}) {
    const [tab, setTab] = React.useState<"pending" | "history">("pending");
    const [pending, setPending] = React.useState<PendingLite[]>([]);
    const [history, setHistory] = React.useState<HistoryRow[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [err, setErr] = React.useState<string | null>(null);
    const router = useRouter();

    const who = (r: { rater?: { username: string | null; name: string | null } | null }) =>
        r?.rater?.username || r?.rater?.name || "Someone";

    useEffect(() => {
        if (!open) return;
        setTab("pending");
    }, [open]);

    const loadRatings = useCallback(async (silent = false) => {
        if (!open) return;
        if (!silent) setLoading(true);
        setErr(null);
        try {
            if (tab === "pending") {
                const rows: PendingLite[] = await fetch("/api/ratings?pendingFor=trainer", {
                    cache: "no-store",
                }).then((r) => r.json());
                setPending(rows || []);
            } else {
                const rows: HistoryRow[] = await fetch("/api/ratings?historyFor=trainer", {
                    cache: "no-store",
                }).then((r) => r.json());
                setHistory(rows || []);
            }
        } catch (e: any) {
            setErr(e.message || "Failed to load");
        } finally {
            if (!silent) setLoading(false);
        }
    }, [open, tab]);

    useEffect(() => {
        if (!open) return;
        void loadRatings();
    }, [open, tab, loadRatings]);

    useLiveRefresh(() => loadRatings(true), { enabled: open, interval: 5000 });

    async function act(id: string, action: "APPROVE" | "DECLINE") {
        try {
            const res = await patchJSON<any>(`/api/ratings/${id}`, { action });

            if (action === "DECLINE") {
                setPending((prev) => prev.filter((r) => r.id !== id));
                return;
            }

            // APPROVED: fetch full details, move to History, and show that tab
            try {
                const full: HistoryRow = await fetch(`/api/ratings/${id}`, {
                    cache: "no-store",
                }).then((r) => r.json());
                setPending((prev) => prev.filter((r) => r.id !== id));
                setHistory((prev) => [full, ...prev]);
                setTab("history");
            } catch {
                setPending((prev) => prev.filter((r) => r.id !== id));
                setTab("history");
                const rows: HistoryRow[] = await fetch("/api/ratings?historyFor=trainer", {
                    cache: "no-store",
                }).then((r) => r.json());
                setHistory(rows || []);
            }

            if (res?.newAverage != null && res?.clients != null) {
                onApproved?.({ newAverage: res.newAverage, clients: res.clients });
            }
        } catch (e: any) {
            alert(e.message || "Failed");
        }
    }

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[999] bg-black/50 dark:bg-black/80 flex items-center justify-center px-4"
            role="dialog"
            aria-modal
        >
            <div className="bg-white rounded-xl p-5 w-full max-w-2xl shadow-xl relative dark:bg-neutral-900 dark:text-gray-100 dark:border dark:border-white/10 dark:shadow-none">
                <button
                    onClick={onClose}
                    className="p-1 rounded hover:bg-black/5 absolute top-4 right-4 dark:hover:bg-white/10 dark:text-gray-300"
                    aria-label="Close"
                >
                    <X size={18} />
                </button>
                <div className="pr-8">
                    <h3 className="text-lg font-semibold">Ratings</h3>
                </div>

                {/* Tabs */}
                <div className="mt-4 inline-flex rounded-full border bg-white p-1 dark:bg-transparent dark:border-white/20">
                    <button
                        className={clsx(
                            "px-3 py-1 text-sm rounded-full",
                            tab === "pending"
                                ? "bg-gray-900 text-white dark:bg-white dark:text-black"
                                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                        )}
                        onClick={() => setTab("pending")}
                    >
                        Pending
                    </button>
                    <button
                        className={clsx(
                            "px-3 py-1 text-sm rounded-full",
                            tab === "history"
                                ? "bg-gray-900 text-white dark:bg-white dark:text-black"
                                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                        )}
                        onClick={() => setTab("history")}
                    >
                        History
                    </button>
                </div>

                {loading ? (
                    <div className="mt-4 text-gray-600 dark:text-gray-300">Loading…</div>
                ) : err ? (
                    <div className="mt-4 text-red-600 dark:text-red-400">{err}</div>
                ) : tab === "pending" ? (
                    <ul className="mt-4 space-y-3">
                        {pending.length === 0 && (
                            <div className="text-gray-600 dark:text-gray-400">Nothing pending.</div>
                        )}
                        {pending.map((r) => (
                            <li key={r.id} className="border rounded p-3 dark:border-white/10">
                                <div className="flex items-center justify-between">
                                    <div className="font-medium">
                                        {r.rater?.username ? (
                                            <button
                                                type="button"
                                                onClick={() => router.push(`/u/${encodeURIComponent(r.rater!.username!)}`)}
                                                className="font-bold hover:underline"
                                            >
                                                {who(r)}
                                            </button>
                                        ) : (
                                            <span>{who(r)}</span>
                                        )}{" "}
                                        left a rating
                                    </div>
                                    <div
                                        className="text-xs text-neutral-500 dark:text-gray-400"
                                        title={new Date(r.createdAt).toLocaleString()}
                                    >
                                        {formatRelativeTime(r.createdAt)}
                                    </div>
                                </div>
                                <div className="mt-3 flex gap-2">
                                    <button
                                        className="px-3 py-1.5 rounded bg-black text-white dark:bg-white dark:text-black"
                                        onClick={() => act(r.id, "APPROVE")}
                                    >
                                        Approve
                                    </button>
                                    <button
                                        className="px-3 py-1.5 rounded border dark:border-white/20 dark:text-gray-100 dark:hover:bg-white/10"
                                        onClick={() => act(r.id, "DECLINE")}
                                    >
                                        Decline
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <ul className="mt-4 space-y-3">
                        {history.length === 0 && (
                            <div className="text-gray-600 dark:text-gray-400">No ratings yet.</div>
                        )}
                        {history.map((r) => (
                            <li key={r.id} className="border rounded p-3 dark:border-white/10">
                                <div className="flex items-center justify-between">
                                    <div className="font-medium">
                                        {r.rater?.username ? (
                                            <button
                                                type="button"
                                                onClick={() => router.push(`/u/${encodeURIComponent(r.rater!.username!)}`)}
                                                className="font-bold hover:underline"
                                            >
                                                {who(r)}
                                            </button>
                                        ) : (
                                            <span>{who(r)}</span>
                                        )}
                                    </div>
                                    <div
                                        className="text-xs text-neutral-500 dark:text-gray-400"
                                        title={new Date(r.createdAt).toLocaleString()}
                                    >
                                        {formatRelativeTime(r.createdAt)}
                                    </div>
                                </div>
                                <div className="mt-1 text-xl">
                                    {"★".repeat(r.stars)}
                                    {"☆".repeat(Math.max(0, 5 - r.stars))}
                                </div>
                                {r.comment && <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{r.comment}</p>}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

/* ---------------------------------- types --------------------------------- */

type BasicPost = { id: string; title: string; imageUrl?: string | null; imageUrls?: string[] };
type FullPost = {
    id: string;
    title: string;
    content: string;
    imageUrl?: string | null;
    imageUrls?: string[];
    createdAt: string;
    author: { id: string; username: string | null; name: string | null } | null;
    likeCount: number;
    didLike: boolean;
    commentCount: number;
};

type ProfilePostsResponse = {
    posts: FullPost[];
    nextCursor: string | null;
    hasMore: boolean;
    totalCount: number;
};

const PROFILE_POSTS_PAGE_SIZE = 9;

/* ------------------------------ main component ---------------------------- */

export function TrainerProfile({
    user,
    posts,
    totalPostCount = 0,
}: {
    user: any;
    posts?: BasicPost[];
    totalPostCount?: number;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { data: session } = useSession();

    const [showRate, setShowRate] = useState(false);
    const [showManageRatings, setShowManageRatings] = useState(false);
    const [showCreatePost, setShowCreatePost] = useState(false);

    const isOwnProfile = pathname === "/profile" || session?.user?.id === user.id;
    const trainer = user.trainerProfile;
    const trainerWebsite = typeof trainer?.website === "string" ? trainer.website.trim() : "";

    // keep local rating/clients in sync after approvals
    const [localRating, setLocalRating] = useState<number | null>(trainer?.rating ?? null);
    const [localClients, setLocalClients] = useState<number>(trainer?.clients ?? 0);

    useEffect(() => {
        if (!isOwnProfile && searchParams?.get("rate") === "1") {
            setShowRate(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (isOwnProfile && searchParams?.get("ratings") === "1") {
            setShowManageRatings(true);
        }
    }, [isOwnProfile, searchParams]);

    const {
        loading,
        isFollowing,
        isPending,
        followers,
        following,
        follow,
        unfollow,
        requestFollow,
        cancelRequest,
        refreshCounts,
    } = useFollow(user.id);

    const [optimisticRequested, setOptimisticRequested] = useState(false);
    useEffect(() => {
        if (!isPending) setOptimisticRequested(false);
    }, [isPending]);

    const canViewPrivate = useMemo(
        () => isOwnProfile || isFollowing || !user.isPrivate,
        [isOwnProfile, isFollowing, user.isPrivate]
    );

    const [shareHint, setShareHint] = useState<string | null>(null);
    const [shareActive, setShareActive] = useState(false);

    // posts
    const [gridPosts, setGridPosts] = useState<BasicPost[]>(posts ?? []);
    const [fullPosts, setFullPosts] = useState<FullPost[] | null>(null);
    const [postsLoading, setPostsLoading] = useState(false);
    const [loadingMorePosts, setLoadingMorePosts] = useState(false);
    const [hasMorePosts, setHasMorePosts] = useState(true);
    const [profilePostCount, setProfilePostCount] = useState(totalPostCount);
    const [focusPostId, setFocusPostId] = useState<string | null>(null);
    const [editingPost, setEditingPost] = useState<FullPost | null>(null);
    const [editingPostLoading, setEditingPostLoading] = useState(false);
    const [viewMode, setViewMode] = useState<"grid" | "scroll">("grid");
    const loadMoreRef = useRef<HTMLDivElement | null>(null);
    const nextCursorRef = useRef<string | null>(null);
    const loadedCountRef = useRef(Math.max(posts?.length ?? 0, PROFILE_POSTS_PAGE_SIZE));

    const toBasicPosts = useCallback(
        (items: FullPost[]): BasicPost[] =>
            items.map((p) => ({
                id: p.id,
                title: p.title,
                imageUrl: p.imageUrl ?? null,
                imageUrls: p.imageUrls ?? [],
            })),
        []
    );

    const fetchProfilePosts = useCallback(
        async ({
            cursor,
            append = false,
            limit = PROFILE_POSTS_PAGE_SIZE,
        }: {
            cursor?: string | null;
            append?: boolean;
            limit?: number;
        } = {}) => {
            if (!canViewPrivate) return;

            if (append) setLoadingMorePosts(true);
            else setPostsLoading(true);

            try {
                const params = new URLSearchParams({
                    authorId: user.id,
                    limit: String(limit),
                });
                if (cursor) params.set("cursor", cursor);

                const res = await fetch(`/api/posts?${params.toString()}`, {
                    cache: "no-store",
                });
                if (!res.ok) return;

                const data: ProfilePostsResponse = await res.json();
                nextCursorRef.current = data.nextCursor;
                setHasMorePosts(data.hasMore);
                setProfilePostCount(data.totalCount ?? 0);

                if (append) {
                    setFullPosts((prev) => {
                        const base = prev ?? [];
                        const existingIds = new Set(base.map((post) => post.id));
                        const merged = [
                            ...base,
                            ...data.posts.filter((post) => !existingIds.has(post.id)),
                        ];
                        loadedCountRef.current = Math.max(merged.length, PROFILE_POSTS_PAGE_SIZE);
                        setGridPosts(toBasicPosts(merged));
                        return merged;
                    });
                    return;
                }

                loadedCountRef.current = Math.max(data.posts.length, PROFILE_POSTS_PAGE_SIZE);
                setFullPosts(data.posts);
                setGridPosts(toBasicPosts(data.posts));
            } finally {
                if (append) setLoadingMorePosts(false);
                else setPostsLoading(false);
            }
        },
        [canViewPrivate, toBasicPosts, user.id]
    );

    const refreshPosts = useCallback(async () => {
        if (!canViewPrivate) return;
        await fetchProfilePosts({ limit: loadedCountRef.current });
    }, [canViewPrivate, fetchProfilePosts]);

    const loadMorePosts = useCallback(async () => {
        if (
            !canViewPrivate ||
            postsLoading ||
            loadingMorePosts ||
            !hasMorePosts ||
            !nextCursorRef.current
        ) {
            return;
        }
        await fetchProfilePosts({
            cursor: nextCursorRef.current,
            append: true,
            limit: PROFILE_POSTS_PAGE_SIZE,
        });
    }, [canViewPrivate, fetchProfilePosts, hasMorePosts, loadingMorePosts, postsLoading]);

    useEffect(() => {
        if (!canViewPrivate) {
            setFullPosts(null);
            setGridPosts([]);
            setHasMorePosts(false);
            nextCursorRef.current = null;
            return;
        }
        void fetchProfilePosts({ limit: PROFILE_POSTS_PAGE_SIZE });
    }, [canViewPrivate, fetchProfilePosts]);

    useLiveRefresh(refreshPosts, { enabled: canViewPrivate, interval: 5000 });

    useEffect(() => {
        if (!isOwnProfile) return;
        const handler = () => {
            refreshPosts();
        };
        window.addEventListener("post-created", handler);
        window.addEventListener("post-updated", handler);
        return () => {
            window.removeEventListener("post-created", handler);
            window.removeEventListener("post-updated", handler);
        };
    }, [isOwnProfile, refreshPosts]);

    useEffect(() => {
        if (!canViewPrivate || !hasMorePosts || !loadMoreRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    void loadMorePosts();
                }
            },
            { rootMargin: "300px 0px" }
        );

        observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [canViewPrivate, hasMorePosts, loadMorePosts, viewMode, gridPosts.length, fullPosts?.length]);

    const handleDeletePost = async (postId: string) => {
        if (!isOwnProfile) return;
        const ok = window.confirm("Delete this post? This cannot be undone.");
        if (!ok) return;

        try {
            const res = await fetch("/api/posts", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: postId }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(data.message || "Failed to delete post.");
                return;
            }

            setFullPosts((prev) => (prev ? prev.filter((p) => p.id !== postId) : prev));
            setGridPosts((prev) => prev.filter((p) => p.id !== postId));
            setProfilePostCount((prev) => Math.max(0, prev - 1));
            if (focusPostId === postId) setFocusPostId(null);
        } catch {
            alert("Failed to delete post.");
        }
    };

    const handleEditPost = async (values: { title: string; content: string }) => {
        if (!editingPost) return;
        const title = values.title.trim();
        const content = values.content.trim();
        if (!title || !content) return;

        try {
            setEditingPostLoading(true);
            const res = await fetch(`/api/posts/${editingPost.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, content }),
            });
            if (!res.ok) throw new Error();
            await refreshPosts();
            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("post-updated"));
            }
            setEditingPost(null);
        } catch {
            alert("Failed to update post.");
        } finally {
            setEditingPostLoading(false);
        }
    };

    // follow lists
    const [showFollowers, setShowFollowers] = useState(false);
    const [showFollowing, setShowFollowing] = useState(false);
    const [list, setList] = useState<any[]>([]);

    const openFollowers = async () => {
        if (!canViewPrivate) return;
        setList([]);
        setShowFollowers(true);
        try {
            const res = await fetch(`/api/user/${user.id}/followers`, { cache: "no-store" });
            setList(res.ok ? await res.json() : []);
        } catch {
            setList([]);
        }
    };
    const openFollowing = async () => {
        if (!canViewPrivate) return;
        setList([]);
        setShowFollowing(true);
        try {
            const res = await fetch(`/api/user/${user.id}/following`, { cache: "no-store" });
            setList(res.ok ? await res.json() : []);
        } catch {
            setList([]);
        }
    };

    const handleFollowButton = async () => {
        if (loading) return;
        try {
            if (user.isPrivate) {
                if (isFollowing) await unfollow();
                else if (isPending || optimisticRequested) {
                    setOptimisticRequested(false);
                    await (cancelRequest?.() ?? unfollow());
                } else {
                    setOptimisticRequested(true);
                    await (requestFollow?.() ?? follow());
                }
            } else {
                if (isFollowing) await unfollow();
                else await follow();
            }
        } finally {
            refreshCounts();
        }
    };

    const handleMessage = () => router.push(`/messages?to=${encodeURIComponent(user.id)}`);

    const handleShare = async () => {
        const url = `${window.location.origin}/u/${user.username || user.id}`;
        try {
            await navigator.clipboard.writeText(url);
            setShareHint("Profile link copied!");
            setShareActive(true);
        } catch {
            setShareHint(url);
            setShareActive(false);
        }
        setTimeout(() => {
            setShareHint(null);
            setShareActive(false);
        }, 2000);
    };

    const [showNotifications, setShowNotifications] = useState(false);
    const showWebsiteAction = Boolean(trainer?.showWebsiteButton && trainerWebsite);

    const requested = user.isPrivate ? isPending || optimisticRequested : false;

    const handleWebsiteClick = () => {
        if (!trainerWebsite) return;
        const href = /^https?:\/\//i.test(trainerWebsite) ? trainerWebsite : `https://${trainerWebsite}`;
        window.open(href, "_blank", "noopener,noreferrer");
    };

    return (
        <div className="flex min-h-screen w-full flex-col lg:flex-row gap-6 lg:gap-0 bg-[#f8f8f8] dark:bg-[#050505] dark:text-gray-100">
            {/* Sidebar – same as TraineeProfile styling */}
            <aside
                className={clsx(
                    "w-full bg-white flex flex-col items-center pt-6 pb-6 shadow-sm lg:shadow-none dark:bg-neutral-900 dark:border-b dark:border-white/5 dark:text-gray-100",
                    "lg:w-72 lg:pt-8 lg:pb-0 lg:sticky lg:top-[84px] lg:self-start lg:min-h-[calc(100vh)] lg:border-r lg:border-white/10"
                )}
            >
                <div className="w-full px-6 flex flex-col items-center gap-4">
                    {/* Avatar */}
                    <div className="flex justify-center items-center">
                        {user.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={user.image}
                                alt={user.username || user.name || "Profile picture"}
                                className="w-20 h-20 rounded-full object-cover border border-gray-200 dark:border-white/20"
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center dark:bg-neutral-800 dark:border-white/20">
                                <span className="text-green-700 font-semibold text-lg select-none dark:text-green-400">
                                    {(user.name || user.username || "U").slice(0, 2)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Name / role */}
                    <div className="text-center space-y-1">
                        <h2 className="font-semibold text-lg text-zinc-900 truncate max-w-[200px] dark:text-white">
                            {user.name || user.username || "User"}
                        </h2>
                        {user.role && (
                            <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                {user.role.toLowerCase()}
                            </div>
                        )}
                    </div>

                    {/* Location */}
                    {user.location && (
                        <div className="text-xs text-gray-500 text-center flex items-center justify-center gap-1 dark:text-gray-400">
                            <MapPin size={15} />
                            <span>{user.location}</span>
                        </div>
                    )}

                    {trainer?.gymStatus && (
                        <div className="flex w-full flex-col items-center gap-1 text-center">
                            {trainer.gymStatus === "LOOKING" && (
                                <p className="inline-flex max-w-full items-center justify-center gap-1 text-center text-xs text-gray-600 dark:text-gray-300">
                                    <Search size={12} className="shrink-0" />
                                    <span>Looking for a gym</span>
                                </p>
                            )}
                            {trainer.gymStatus === "TRAINER" && trainer.gymName && (
                                <p className="inline-flex max-w-full flex-wrap items-center justify-center gap-1 text-center text-xs text-zinc-900 dark:text-white">
                                    Trainer @{" "}
                                    <span className="font-normal text-zinc-900 dark:text-white">
                                        {trainer.gymName}
                                    </span>
                                </p>
                            )}
                        </div>
                    )}

                    {/* Bio */}
                    {trainer?.bio && (
                        <p className="mt-3 text-sm leading-relaxed text-zinc-700 text-center line-clamp-4 dark:text-gray-300">
                            {trainer.bio}
                        </p>
                    )}

                    {/* Rating / clients + Followers / Following / Posts */}
                    <div className="w-full mt-2 rounded-2xl border border-gray-200 px-4 py-3 space-y-3 dark:border-white/10">
                        <ProfileStat
                            label="rating"
                            value={localRating != null ? localRating.toFixed(1) : "N/A"}
                        />
                        <ProfileStat label="clients" value={localClients ?? 0} />

                        <div className="pt-1 border-t border-gray-100 dark:border-white/10">
                            <div className="flex items-center justify-between text-center text-xs text-gray-500 dark:text-gray-400">
                                <button
                                    onClick={openFollowers}
                                    disabled={!canViewPrivate}
                                    className={clsx(
                                        "flex-1 flex flex-col py-1 rounded-md text.center items-center",
                                        canViewPrivate
                                            ? "hover:bg-gray-50 transition dark:hover:bg-white/5"
                                            : "opacity-60 cursor-not-allowed"
                                    )}
                                    title={canViewPrivate ? "View followers" : "Private"}
                                >
                                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                                        {followers}
                                    </span>
                                    <span>followers</span>
                                </button>
                                <div className="w-px h-8 bg-gray-200 dark:bg-white/10" />
                                <button
                                    onClick={openFollowing}
                                    disabled={!canViewPrivate}
                                    className={clsx(
                                        "flex-1 flex flex-col py-1 rounded-md text-center items-center",
                                        canViewPrivate
                                            ? "hover:bg-gray-50 transition dark:hover:bg-white/5"
                                            : "opacity-60 cursor-not-allowed"
                                    )}
                                    title={canViewPrivate ? "View following" : "Private"}
                                >
                                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                                        {following}
                                    </span>
                                    <span>following</span>
                                </button>
                                <div className="w-px h-8 bg-gray-200 dark:bg-white/10" />
                                <div className="flex-1 flex flex-col py-1 text-center items-center">
                                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                                        {canViewPrivate ? profilePostCount : "—"}
                                    </span>
                                    <span>posts</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="w-full mt-4 space-y-2">
                        {!isOwnProfile ? (
                            <>
                                <button
                                    onClick={handleFollowButton}
                                    disabled={loading}
                                    className={clsx(
                                        "w-full py-2 rounded-full text-sm font-medium transition",
                                        "border border-zinc-900 text-zinc-900 hover:bg-zinc-900 hover:text-white",
                                        "dark:border-white dark:text-white dark:hover:bg-white/10",
                                        "disabled:opacity-60 disabled:cursor-not-allowed"
                                    )}
                                >
                                    {user.isPrivate ? (
                                        isFollowing ? (
                                            <span className="inline-flex items-center justify-center gap-2">
                                                <UserMinus size={16} />
                                                <span>Unfollow</span>
                                            </span>
                                        ) : requested ? (
                                            <span className="inline-flex items-center justify-center">
                                                Request sent
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center justify-center gap-2">
                                                <UserPlus size={16} />
                                                <span>Request to follow</span>
                                            </span>
                                        )
                                    ) : isFollowing ? (
                                        <span className="inline-flex items-center justify-center gap-2">
                                            <UserMinus size={16} />
                                            <span>Unfollow</span>
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center justify-center gap-2">
                                            <UserPlus size={16} />
                                            <span>Follow</span>
                                        </span>
                                    )}
                                </button>


                                <div
                                    className={clsx(
                                        "grid gap-2",
                                        showWebsiteAction ? "grid-cols-4" : "grid-cols-3"
                                    )}
                                >
                                    <button
                                        onClick={handleMessage}
                                        className="h-9 w-full rounded-full border text-xs text-zinc-700 bg-white hover:bg-gray-50 transition flex items-center justify-center gap-1 dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                        title="Message"
                                    >
                                        <MessageSquare size={16} />
                                    </button>
                                    <button
                                        onClick={handleShare}
                                        className={clsx(
                                            "h-9 w-full rounded-full border bg-white hover:bg-gray-50 transition inline-flex items-center justify-center p-0 dark:bg-transparent dark:hover:bg-white/10",
                                            shareActive
                                                ? "text-green-500 border-green-500 dark:text-green-400 dark:border-green-500"
                                                : "text-zinc-700 border-gray-200 dark:text-gray-100 dark:border-white/20"
                                        )}
                                        title="Copy profile link"
                                    >
                                        <Share2 size={16} />
                                    </button>
                                    {showWebsiteAction && (
                                        <button
                                            onClick={handleWebsiteClick}
                                            className="h-9 w-full rounded-full border bg-white hover:bg-gray-50 transition inline-flex items-center justify-center p-0 text-zinc-700 border-gray-200 dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                            title="Visit website"
                                        >
                                            <LinkIcon size={16} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowRate(true)}
                                        className="h-9 w-full rounded-full border bg-white hover:bg-gray-50 transition flex items-center justify-center dark:bg-transparent dark:border-white/20 dark:text-gray-100 dark:hover:bg-white/10"
                                        title="Rate this trainer"
                                    >
                                        <Star size={16} />
                                    </button>
                                </div>

                                {shareHint && (
                                    <div className="text-[11px] text-gray-500 text-center dark:text-gray-400">
                                        {shareHint}
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div
                                    className={clsx(
                                        "mx-auto grid w-full max-w-[312px] gap-2 sm:hidden",
                                        showWebsiteAction ? "grid-cols-4" : "grid-cols-3"
                                    )}
                                >
                                    {showWebsiteAction && (
                                        <button
                                            className="inline-flex min-h-[44px] w-full flex-col items-center justify-center gap-0.5 rounded-2xl border bg-white px-1 py-2 text-[9px] leading-tight text-zinc-700 transition hover:bg-gray-50 dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                            onClick={handleWebsiteClick}
                                            aria-label="Website"
                                            title="Website"
                                        >
                                            <LinkIcon size={16} className="shrink-0" />
                                            <span className="max-w-full text-center">Website</span>
                                        </button>
                                    )}
                                    <button
                                        className="inline-flex min-h-[44px] w-full flex-col items-center justify-center gap-0.5 rounded-2xl border bg-white px-1 py-2 text-[9px] leading-tight text-zinc-700 transition hover:bg-gray-50 dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                        onClick={() => router.push("/settings")}
                                        aria-label="Edit profile"
                                        title="Edit profile"
                                    >
                                        <UserPen size={16} className="shrink-0" />
                                        <span className="max-w-full text-center">Edit Profile</span>
                                    </button>
                                    <button
                                        className="inline-flex min-h-[44px] w-full flex-col items-center justify-center gap-0.5 rounded-2xl border bg-white px-1 py-2 text-[9px] leading-tight text-zinc-700 transition hover:bg-gray-50 dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                        onClick={() => setShowManageRatings(true)}
                                        aria-label="Ratings"
                                        title="Ratings"
                                    >
                                        <Star size={16} className="shrink-0" />
                                        <span className="max-w-full text-center">Ratings</span>
                                    </button>
                                    <button
                                        className="inline-flex min-h-[44px] w-full flex-col items-center justify-center gap-0.5 rounded-2xl border bg-white px-1 py-2 text-[9px] leading-tight text-zinc-700 transition hover:bg-gray-50 dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                        onClick={() => setShowNotifications(true)}
                                        aria-label="Notifications"
                                        title="Notifications"
                                    >
                                        <Bell size={16} className="shrink-0" />
                                        <span className="max-w-full text-center">Notifications</span>
                                    </button>
                                </div>
                                <div className="mx-auto hidden w-full max-w-[312px] space-y-2 sm:block">
                                    {showWebsiteAction && (
                                        <button
                                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border bg-white px-3 py-2 text-[13px] text-zinc-700 transition hover:bg-gray-50 sm:text-sm dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                            onClick={handleWebsiteClick}
                                        >
                                            <LinkIcon size={16} className="shrink-0" />
                                            <span>Website</span>
                                        </button>
                                    )}
                                    <div className="grid w-full grid-cols-[0.96fr_1.04fr] gap-2">
                                        <button
                                            className="inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-full border bg-white px-3 py-2 text-[13px] text-zinc-700 transition hover:bg-gray-50 sm:text-sm dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                            onClick={() => router.push("/settings")}
                                            aria-label="Edit profile"
                                            title="Edit profile"
                                        >
                                            <UserPen size={16} className="shrink-0" />
                                            <span className="whitespace-nowrap">Edit Profile</span>
                                        </button>
                                        <button
                                            className="inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-full border bg-white px-3 py-2 text-[13px] text-zinc-700 transition hover:bg-gray-50 sm:text-sm dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                            onClick={() => setShowManageRatings(true)}
                                            aria-label="Ratings"
                                            title="Ratings"
                                        >
                                            <Star size={16} className="shrink-0" />
                                            <span>Ratings</span>
                                        </button>
                                    </div>
                                    <button
                                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border bg-white px-3 py-2 text-[13px] text-zinc-700 transition hover:bg-gray-50 sm:text-sm dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                        onClick={() => setShowNotifications(true)}
                                    >
                                        <Bell size={16} className="shrink-0" />
                                        <span>Notifications</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 relative bg-[#f8f8f8] min-h-screen lg:min-h-full dark:bg-[#050505]">
                {!canViewPrivate ? (
                    <PrivatePlaceholder />
                ) : (
                    <>
                            <div className="mb-4 flex items-center justify-between bg-[#f8f8f8] py-2 lg:py-0 lg:sticky lg:top-0 lg:z-10 dark:bg-[#050505]">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Posts</h3>
                                {isOwnProfile && (
                                    <button
                                        type="button"
                                        onClick={() => setShowCreatePost(true)}
                                        className="px-3 py-1.5 rounded-full border text-xs font-medium bg-white hover:bg-gray-50 transition dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                    >
                                        + Add Post
                                    </button>
                                )}
                            </div>
                            <div className="inline-flex rounded-full border bg-white p-1 shadow-sm dark:bg-transparent dark:border-white/10">
                                <button
                                    className={clsx(
                                        "px-3 py-1 text-sm rounded-full",
                                        viewMode === "grid"
                                            ? "bg-gray-900 text-white dark:bg-white dark:text-black"
                                            : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                                    )}
                                    onClick={() => setViewMode("grid")}
                                >
                                    Grid
                                </button>
                                <button
                                    className={clsx(
                                        "px-3 py-1 text-sm rounded-full",
                                        viewMode === "scroll"
                                            ? "bg-gray-900 text-white dark:bg-white dark:text-black"
                                            : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                                    )}
                                    onClick={() => setViewMode("scroll")}
                                >
                                    Scroll
                                </button>
                            </div>
                        </div>

                        {postsLoading && !fullPosts && (
                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900 border-t-transparent dark:border-white dark:border-t-transparent" />
                                Loading posts…
                            </div>
                        )}

                        {viewMode === "grid" ? (
                            <MediaGrid posts={gridPosts} onOpen={(id) => setFocusPostId(id)} />
                        ) : (
                            <ScrollFeed
                                posts={fullPosts ?? []}
                                canDelete={isOwnProfile}
                                onEdit={(post) => setEditingPost(post)}
                                onDelete={handleDeletePost}
                                onOpen={(id) => setFocusPostId(id)}
                                onLike={async (id) => {
                                    try {
                                        await fetch(`/api/posts/${encodeURIComponent(id)}/like`, {
                                            method: "POST",
                                        });
                                        await refreshPosts();
                                    } catch {
                                        /* ignore */
                                    }
                                }}
                            />
                        )}

                        {hasMorePosts && (
                            <div ref={loadMoreRef} className="h-6 w-full" aria-hidden="true" />
                        )}

                        {loadingMorePosts && (
                            <div className="flex items-center justify-center py-4 text-gray-500 dark:text-gray-400">
                                <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-900 border-t-transparent dark:border-white dark:border-t-transparent" />
                            </div>
                        )}
                    </>
                )}

                {focusPostId && (
                                    <div className="fixed inset-0 bg-[#f8f8f8] z-50 w-full h-full overflow-y-auto lg:absolute lg:overflow-hidden dark:bg-[#050505]">
                                        <div className="p-4 flex items-center justify-between sticky top-0 bg-[#f8f8f8] z-10 dark:bg-[#050505]">
                                            <button
                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white hover:bg-zinc-50 text-sm dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                                onClick={() => setFocusPostId(null)}
                                                title="Back to profile"
                                            >
                                                <ArrowLeft size={16} />
                                                Back
                                            </button>
                                            {isOwnProfile && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        className="p-2 rounded-full text-gray-300 transition hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
                                                        title="Edit post"
                                                        onClick={() => {
                                                            const target = fullPosts?.find((post) => post.id === focusPostId) ?? null;
                                                            if (target) setEditingPost(target);
                                                        }}
                                                    >
                                                        <Pencil size={18} />
                                                    </button>
                                                    <button
                                                        className="p-2 rounded-full text-gray-300 hover:text-red-500 transition dark:text-gray-500 dark:hover:text-red-500"
                                                        title="Delete post"
                                                        onClick={() => handleDeletePost(focusPostId)}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="px-3 sm:px-6 pb-6">
                                            <div className="rounded-xl bg-[#f8f8f8] scrollbar-slim max-w-full max-h-[calc(100vh-140px)] overflow-y-auto dark:bg-[#050505] dark:shadow-none">
                                                <PostDetail postId={focusPostId} flat />
                                            </div>
                                        </div>
                                    </div>
                                )}
            </main>

            {/* Modals */}
            <FollowListModal
                open={showFollowers}
                title="Followers"
                items={list}
                onClose={() => setShowFollowers(false)}
                currentUserId={session?.user?.id}
            />
            <FollowListModal
                open={showFollowing}
                title="Following"
                items={list}
                onClose={() => setShowFollowing(false)}
                currentUserId={session?.user?.id}
            />
            <NotificationsModal
                open={showNotifications}
                onClose={() => setShowNotifications(false)}
                onAnyChange={refreshCounts}
            />

            <RateTrainerModal
                open={showRate}
                onClose={() => setShowRate(false)}
                trainerId={trainer?.id}
            />
            <ManageTrainerRatingsModal
                open={showManageRatings}
                onClose={() => {
                    setShowManageRatings(false);
                    if (searchParams?.get("ratings") === "1") {
                        const currentPath = pathname ?? "/profile";
                        const nextParams = new URLSearchParams(searchParams.toString());
                        nextParams.delete("ratings");
                        const nextUrl = nextParams.toString() ? `${currentPath}?${nextParams.toString()}` : currentPath;
                        router.replace(nextUrl, { scroll: false });
                    }
                }}
                onApproved={({ newAverage, clients }) => {
                    setLocalRating(newAverage ?? null);
                    setLocalClients(clients ?? 0);
                }}
            />

            {showCreatePost && <CreatePost onClose={() => setShowCreatePost(false)} />}
            <EditPostDialog
                open={editingPost !== null}
                initialTitle={editingPost?.title ?? ""}
                initialContent={editingPost?.content ?? ""}
                loading={editingPostLoading}
                onCancel={() => {
                    if (editingPostLoading) return;
                    setEditingPost(null);
                }}
                onSave={(values) => void handleEditPost(values)}
            />
        </div>
    );
}

function ProfileStat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="capitalize">{label}</span>
            <span className="font-semibold text-zinc-900 dark:text-white">{value}</span>
        </div>
    );
}

function MediaGrid({ posts, onOpen }: { posts: BasicPost[]; onOpen: (id: string) => void }) {
    return (
        <div className="grid grid-cols-3 gap-2">
            {posts.map((post) => (
                <button
                    key={post.id}
                    className="bg-white rounded-lg flex items-center justify-center w-full h-56 overflow-hidden relative border border-zinc-200 transition hover:border-black hover:shadow-lg hover:ring-4 hover:ring-black dark:bg-neutral-900 dark:border-white/10 dark:hover:border-white dark:hover:ring-white"
                    title={post.title}
                    onClick={() => onOpen(post.id)}
                >
                    {post.imageUrl ? (
                        <img
                            src={post.imageUrl}
                            alt={post.title}
                            className="object-cover w-full h-full"
                        />
                    ) : (
                        <span className="text-gray-600 font-semibold text-lg text-center px-4 dark:text-gray-100">
                            {post.title}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}


function ScrollFeed({
    posts,
    onOpen,
    onLike,
    canDelete,
    onEdit,
    onDelete,
}: {
    posts: FullPost[];
    onOpen: (id: string) => void;
    onLike: (id: string) => void | Promise<void>;
    canDelete: boolean;
    onEdit: (post: FullPost) => void;
    onDelete: (id: string) => void | Promise<void>;
}) {
    const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
    const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const fmt = (iso: string) => formatRelativeTime(iso);

    const toggleComments = (id: string) =>
        setOpenComments((prev) => ({ ...prev, [id]: !prev[id] }));

    const handleShare = async (id: string) => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const url = `${origin}/post/${encodeURIComponent(id)}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopiedId(id);
            setTimeout(() =>
                setCopiedId((prev) => (prev === id ? null : prev)),
                2000
            );
        } catch {
            alert('Failed to copy link.');
        }
    };

    if (!posts || posts.length === 0) {
        return <div className="text-gray-400 text-center py-12 dark:text-gray-500">No posts yet.</div>;
    }

    return (
        <div className="space-y-6 max-w-xl dark:text-gray-100">
            {posts.map((p) => {
                const authorBits = (
                    <>
                        <span className="text-xs text-gray-500 dark:text-gray-300">
                            by{' '}
                            {p.author?.username ? (
                                <Link
                                    href={`/u/${encodeURIComponent(p.author.username)}`}
                                    className="font-semibold hover:underline"
                                >
                                    {p.author.username}
                                </Link>
                            ) : (
                                <span className="font-semibold">Unknown</span>
                            )}
                        </span>
                        <span
                            className="text-xs text-gray-400 dark:text-gray-300"
                            title={new Date(p.createdAt).toLocaleString()}
                        >
                            {fmt(p.createdAt)}
                        </span>
                    </>
                );

                const actionButtons = (
                    <>
                        <button
                            className={clsx(
                                'flex items-center gap-1 text-xs transition',
                                p.didLike
                                    ? 'text-red-500 font-bold'
                                    : 'text-gray-400 hover:text-red-400 dark:text-gray-300 dark:hover:text-red-500'
                            )}
                            onClick={() => onLike(p.id)}
                            title={p.didLike ? 'Unlike' : 'Like'}
                        >
                            <Heart
                                size={18}
                                fill={p.didLike ? 'currentColor' : 'none'}
                                strokeWidth={2}
                            />
                            {p.likeCount ?? 0}
                        </button>

                        <button
                            className={clsx(
                                'flex items-center gap-1 text-xs transition',
                                openComments[p.id]
                                    ? 'text-green-500 font-semibold'
                                    : 'text-gray-400 hover:text-green-600 dark:text-gray-300 dark:hover:text-green-500'
                            )}
                            onClick={() => toggleComments(p.id)}
                            title="Toggle comments"
                        >
                            <MessageCircle size={16} />
                            {commentCounts[p.id] ?? p.commentCount ?? 0}
                        </button>

                        <button
                            className="flex items-center gap-1 text-xs transition text-gray-500 hover:text-green-700 dark:text-gray-300 dark:hover:text-green-500"
                            onClick={() => handleShare(p.id)}
                            title="Copy link"
                        >
                            <Share2 size={16} />
                            {copiedId === p.id ? 'Copied' : 'Share'}
                        </button>
                    </>
                );

                return (
                    <article
                        key={p.id}
                        className="relative bg-white rounded-2xl shadow-lg px-6 py-5 text-gray-900 dark:bg-neutral-900 dark:border dark:border-white/10 dark:shadow-none dark:text-gray-100"
                    >
                        {canDelete && (
                            <div className="absolute right-4 top-4 flex items-center gap-2">
                                <button
                                    className="text-gray-300 transition hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
                                    title="Edit post"
                                    onClick={() => onEdit(p)}
                                >
                                    <Pencil size={18} />
                                </button>
                                <button
                                    className="text-gray-300 hover:text-red-500 transition dark:text-gray-500 dark:hover:text-red-500"
                                    title="Delete post"
                                    onClick={() => onDelete(p.id)}
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        )}

                        <div className="flex flex-col gap-1 mb-2">
                            <button
                                className="font-bold text-lg text-gray-800 text-left hover:underline dark:text-white"
                                onClick={() => onOpen(p.id)}
                                title="Open post"
                            >
                                {p.title}
                            </button>

                            <div className="flex flex-wrap items-center gap-2 md:hidden text-gray-600 dark:text-gray-400">
                                {authorBits}
                            </div>
                            <div className="hidden md:flex flex-wrap items-center gap-3 text-gray-600 dark:text-gray-400">
                                {authorBits}
                                <div className="flex flex-wrap items-center gap-4">
                                    {actionButtons}
                                </div>
                            </div>
                        </div>

                        <div className="mt-2 flex md:hidden flex-wrap items-center gap-4 text-gray-600 dark:text-gray-400">
                            {actionButtons}
                        </div>

                        {p.content && (
                            <div className="text-zinc-800 mt-3 whitespace-pre-wrap dark:text-gray-200">{p.content}</div>
                        )}

                        {getPostImageUrls(p).length > 0 && (
                            <div className="mt-3">
                                <PostImageCarousel
                                    imageUrls={getPostImageUrls(p)}
                                    alt={p.title}
                                    onOpen={() => onOpen(p.id)}
                                    imageClassName="w-full max-h-[540px] object-contain"
                                />
                            </div>
                        )}

                        {openComments[p.id] && (
                            <div className="mt-3">
                                <PostComments
                                    postId={p.id}
                                    onCountChange={(count) =>
                                        setCommentCounts((prev) => ({ ...prev, [p.id]: count }))
                                    }
                                />
                            </div>
                        )}
                    </article>
                );
            })}
        </div>
    );
}


function PrivatePlaceholder() {
    return (
        <div className="w-full h-[60vh] flex items-center justify-center">
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                <Lock size={20} />
                <span>This account is private. Follow to see their posts.</span>
            </div>
        </div>
    );
}
