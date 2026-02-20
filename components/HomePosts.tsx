// components/HomePosts.tsx
'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Trash2, Heart, MessageCircle, Share2, X, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PostComments } from "@/components/PostComments";
import { formatRelativeTime } from "@/lib/utils";

type LiteUser = {
    id: string;
    username: string | null;
    name: string | null;
    image?: string | null;
};

type ConversationRow = {
    id: string;
    updatedAt: string;
    isGroup?: boolean;
    groupName?: string | null;
    groupMembers?: LiteUser[];
    other: LiteUser | null;
    lastMessage?: {
        id: string;
        content: string;
        createdAt: string;
        isMine: boolean;
        imageUrls?: string[];
    } | null;
};

type Post = {
    id: string;
    title: string;
    content: string;
    imageUrl?: string | null;
    createdAt: string;
    author: { username: string | null; email: string | null } | null;
    likeCount?: number;
    didLike?: boolean;
    commentCount?: number;
    comments?: any[];
};

export default function HomePosts({ initialPosts }: { initialPosts?: Post[] }) {
    const router = useRouter();
    const { data: session } = useSession();
    const username = session?.user?.username;

    const [posts, setPosts] = useState<Post[]>(initialPosts ?? []);
    const [loading, setLoading] = useState<boolean>(
        !initialPosts || initialPosts.length === 0
    );
    const [error, setError] = useState<string | null>(null);

    const [openComments, setOpenComments] = useState<{ [postId: string]: boolean }>({});

    // SHARE MODAL STATE
    const [sharePostId, setSharePostId] = useState<string | null>(null);
    const [convos, setConvos] = useState<ConversationRow[]>([]);
    const [convosLoading, setConvosLoading] = useState(false);
    const [convosError, setConvosError] = useState<string | null>(null);

    const [shareQuery, setShareQuery] = useState("");
    const [shareResults, setShareResults] = useState<LiteUser[]>([]);
    const [shareSearching, setShareSearching] = useState(false);

    const hasSession = !!session;

    // Infinite scroll state
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    // -------- Initial fetch (only if no initialPosts from SSR) --------
    const fetchInitialPosts = useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const res = await fetch("/api/posts", { cache: "no-store" });
            if (!res.ok) throw new Error();
            const data: Post[] = await res.json();
            setPosts(data);
            setHasMore(true);
        } catch {
            setError("Failed to fetch posts.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!initialPosts || initialPosts.length === 0) {
            fetchInitialPosts();
        }
    }, [initialPosts, fetchInitialPosts]);

    // -------- Auto-refresh when a post is created --------
    useEffect(() => {
        const handlePostCreated = () => {
            // Re-fetch first page so new post appears at the top
            fetchInitialPosts();
        };

        if (typeof window !== "undefined") {
            window.addEventListener("post-created", handlePostCreated);
        }

        return () => {
            if (typeof window !== "undefined") {
                window.removeEventListener("post-created", handlePostCreated);
            }
        };
    }, [fetchInitialPosts]);

    // -------- Infinite scroll: load more when sentinel is visible --------
    const fetchMorePosts = async () => {
        if (isLoadingMore || !hasMore) return;
        if (posts.length === 0) return;

        setIsLoadingMore(true);
        setError(null);

        try {
            const lastPost = posts[posts.length - 1];
            const cursor = lastPost?.createdAt;

            const url = cursor
                ? `/api/posts?cursor=${encodeURIComponent(cursor)}`
                : "/api/posts";

            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) throw new Error();

            const newPosts: Post[] = await res.json();

            if (newPosts.length === 0) {
                setHasMore(false);
            } else {
                setPosts(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const deduped = newPosts.filter(p => !existingIds.has(p.id));
                    return [...prev, ...deduped];
                });
            }
        } catch {
            setError("Failed to load more posts.");
        } finally {
            setIsLoadingMore(false);
        }
    };

    useEffect(() => {
        if (!hasMore) return;

        const node = loadMoreRef.current;
        if (!node) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const first = entries[0];
                if (first.isIntersecting) {
                    fetchMorePosts();
                }
            },
            {
                root: null,
                rootMargin: "200px",
                threshold: 0.1,
            }
        );

        observer.observe(node);

        return () => {
            observer.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasMore, posts.length, isLoadingMore]);

    // -------- Existing handlers --------
    const handleDelete = async (id: string) => {
        try {
            const res = await fetch("/api/posts", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) throw new Error();
            setPosts((p) => p.filter((post) => post.id !== id));
        } catch {
            alert("Failed to delete post.");
        }
    };

    const handleLike = async (id: string) => {
        // optimistic like toggle
        setPosts(prev =>
            prev.map(post => {
                if (post.id !== id) return post;

                const wasLiked = !!post.didLike;
                const prevCount = post.likeCount ?? 0;

                return {
                    ...post,
                    didLike: !wasLiked,
                    likeCount: prevCount + (wasLiked ? -1 : 1),
                };
            })
        );

        try {
            const res = await fetch(`/api/posts/${id}/like`, { method: "POST" });
            if (!res.ok) throw new Error();
            const data = await res.json().catch(() => ({}));
            if (typeof data.likeCount === "number" && typeof data.liked === "boolean") {
                setPosts(prev =>
                    prev.map(post => {
                        if (post.id !== id) return post;
                        return {
                            ...post,
                            didLike: data.liked,
                            likeCount: data.likeCount,
                        };
                    })
                );
            }
        } catch {
            // rollback on failure
            setPosts(prev =>
                prev.map(post => {
                    if (post.id !== id) return post;

                    const wasLiked = !!post.didLike;
                    const prevCount = post.likeCount ?? 0;

                    return {
                        ...post,
                        didLike: !wasLiked,
                        likeCount: prevCount + (wasLiked ? -1 : 1),
                    };
                })
            );
            alert("Failed to like/unlike post.");
        }
    };

    const toggleComments = (postId: string) => {
        setOpenComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
    };

    const handleCommentCount = (postId: string, count: number) => {
        setPosts((prev) =>
            prev.map((p) =>
                p.id === postId
                    ? { ...p, commentCount: count }
                    : p
            )
        );
    };

    // -------- Share modal helpers --------
    const openShareModal = async (postId: string) => {
        setSharePostId(postId);
        setConvosError(null);
        setConvosLoading(true);
        try {
            const res = await fetch("/api/messages/conversations", { cache: "no-store" });
            if (!res.ok) throw new Error();
            const data: ConversationRow[] = await res.json();
            setConvos(data);
        } catch {
            setConvosError("Failed to load conversations.");
        } finally {
            setConvosLoading(false);
        }
    };

    // Search followers to start new chat
    useEffect(() => {
        const q = shareQuery.trim();
        if (!sharePostId) return;
        if (q.length < 2) {
            setShareResults([]);
            setShareSearching(false);
            return;
        }
        let alive = true;
        setShareSearching(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(
                    `/api/messages/search?q=${encodeURIComponent(q)}`,
                    { cache: "no-store" }
                );
                if (!res.ok) throw new Error();
                const data: { followers: LiteUser[] } = await res.json();
                if (!alive) return;
                setShareResults(data.followers);
            } catch {
                if (alive) setShareResults([]);
            } finally {
                if (alive) setShareSearching(false);
            }
        }, 250);
        return () => {
            alive = false;
            clearTimeout(t);
        };
    }, [shareQuery, sharePostId]);

    const displayName = (u?: LiteUser | null) =>
        u?.username || u?.name || "User";

    const conversationTitle = (c: ConversationRow) => {
        const realGroup = c.isGroup && ((c.groupMembers?.length ?? 0) >= 2);
        if (realGroup) return c.groupName || "Group";
        return displayName(c.other);
    };

    const onPickConversationToShare = (c: ConversationRow) => {
        if (!sharePostId) return;
        const realGroup = c.isGroup && ((c.groupMembers?.length ?? 0) >= 2);
        if (realGroup) {
            router.push(
                `/messages?convoId=${encodeURIComponent(
                    c.id
                )}&shareType=post&shareId=${encodeURIComponent(sharePostId)}`
            );
        } else if (c.other) {
            const pretty = c.other.username || c.other.id;
            router.push(
                `/messages?to=${encodeURIComponent(
                    pretty
                )}&shareType=post&shareId=${encodeURIComponent(sharePostId)}`
            );
        } else {
            router.push(
                `/messages?convoId=${encodeURIComponent(
                    c.id
                )}&shareType=post&shareId=${encodeURIComponent(sharePostId)}`
            );
        }
        setSharePostId(null);
    };

    const onPickUserToShare = (u: LiteUser) => {
        if (!sharePostId) return;
        const pretty = u.username || u.id;
        router.push(
            `/messages?to=${encodeURIComponent(
                pretty
            )}&shareType=post&shareId=${encodeURIComponent(sharePostId)}`
        );
        setSharePostId(null);
    };

    const canShare = useMemo(() => !!session, [session]);

    if (loading && posts.length === 0) {
        return <div className="p-8 text-gray-500 dark:text-gray-300">Loading posts...</div>;
    }
    if (error && posts.length === 0) {
        return <div className="p-8 text-red-500 dark:text-red-400">{error}</div>;
    }

    return (
        <>
            <div className="w-full max-w-xl mx-auto mt-6">
                <div className="space-y-6">
                    {posts.map((post) => {
                        const actionButtons = (
                            <>
                                <button
                                    className={clsx(
                                        "flex items-center gap-1 text-xs transition",
                                        post.didLike
                                            ? "text-red-500 font-bold"
                                            : "text-gray-400 hover:text-red-400 dark:text-gray-300 dark:hover:text-red-500"
                                    )}
                                    onClick={() => handleLike(post.id)}
                                    disabled={!session}
                                    title={
                                        session
                                            ? post.didLike
                                                ? "Unlike"
                                                : "Like"
                                            : "Sign in to like"
                                    }
                                >
                                    <Heart
                                        size={18}
                                        fill={post.didLike ? "currentColor" : "none"}
                                        strokeWidth={2}
                                    />
                                    {post.likeCount ?? 0}
                                </button>

                                <button
                                    className={clsx(
                                        "flex items-center gap-1 text-xs transition",
                                        openComments[post.id]
                                            ? "text-green-500 font-semibold"
                                            : "text-gray-400 hover:text-green-600 dark:text-gray-300 dark:hover:text-green-500"
                                    )}
                                    onClick={() => toggleComments(post.id)}
                                    title="Show comments"
                                >
                                    <MessageCircle size={16} />
                                    {post.commentCount ?? 0}
                                </button>

                                <button
                                    className={clsx(
                                        "flex items-center gap-1 text-xs transition",
                                        canShare
                                            ? "text-gray-500 hover:text-green-600 dark:text-gray-200 dark:hover:text-green-500"
                                            : "text-gray-300 cursor-not-allowed dark:text-gray-500 dark:hover:text-green-500"
                                    )}
                                    onClick={() => canShare && openShareModal(post.id)}
                                    disabled={!canShare}
                                    title={
                                        canShare
                                            ? "Share via Messenger"
                                            : "Sign in to share"
                                    }
                                >
                                    <Share2 size={16} />
                                    Share
                                </button>
                            </>
                        );

                        return (
                            <div
                                key={post.id}
                                className="relative rounded-2xl bg-white px-6 py-5 shadow-lg dark:border dark:border-white/10 dark:bg-neutral-900 dark:shadow-none"
                            >
                            {post.author?.username === username && (
                                <button
                                    onClick={() => handleDelete(post.id)}
                                className="absolute right-4 top-4 text-gray-300 hover:text-red-500 transition dark:text-gray-500 dark:hover:text-red-500"
                                    title="Delete post"
                                >
                                    <Trash2 size={20} />
                                </button>
                            )}

                            <div className="flex flex-col gap-1 mb-2">
                                <span className="font-bold text-lg text-gray-800 dark:text-white">
                                    {post.title}
                                </span>
                                {(() => {
                                    const authorBits = (
                                        <>
                                            <span className="text-xs text-gray-500 dark:text-gray-300">
                                                by{" "}
                                                {post.author?.username ? (
                                                    post.author.username === username ? (
                                                        <Link
                                                            href="/profile"
                                                            className="font-semibold hover:underline"
                                                            title="View your profile"
                                                        >
                                                            {post.author.username}
                                                        </Link>
                                                    ) : (
                                                        <Link
                                                            href={`/u/${encodeURIComponent(
                                                                post.author.username
                                                            )}`}
                                                            className="font-semibold hover:underline"
                                                            title={`View ${post.author.username}'s profile`}
                                                        >
                                                            {post.author.username}
                                                        </Link>
                                                    )
                                                ) : (
                                                    <span className="font-semibold">Unknown</span>
                                                )}
                                            </span>
                                            <span
                                                className="text-xs text-gray-400 dark:text-gray-300"
                                                title={new Date(post.createdAt).toLocaleString()}
                                            >
                                                {formatRelativeTime(post.createdAt)}
                                            </span>
                                        </>
                                    );

                                    return (
                                        <>
                                            <div className="flex flex-wrap items-center gap-2 md:hidden">
                                                {authorBits}
                                            </div>
                                            <div className="hidden md:flex flex-wrap items-center gap-3">
                                                {authorBits}
                                                <div className="flex flex-wrap items-center gap-4">
                                                    {actionButtons}
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}

                                <div className="mt-2 flex md:hidden flex-wrap items-center gap-4">
                                    {actionButtons}
                                </div>
                            </div>

                            {/* Text content */}
                            {post.content && (
                                <div className="text-gray-700 mt-2 whitespace-pre-wrap dark:text-gray-200">
                                    {post.content}
                                </div>
                            )}

                            {/* Image (optional) */}
                            {post.imageUrl && (
                                <div className="mt-3">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={post.imageUrl}
                                        alt={post.title}
                                        className="w-full max-h-[540px] object-contain rounded-xl border"
                                    />
                                </div>
                            )}

                            {/* Comments */}
                            {openComments[post.id] && (
                                <div className="mt-3">
                                    <PostComments
                                        postId={post.id}
                                        onCountChange={(count) => handleCommentCount(post.id, count)}
                                    />
                                </div>
                            )}
                        </div>
                        );
                    })}

                    {posts.length === 0 && !loading && (
                        <div className="text-gray-400 text-center py-12 dark:text-gray-300">
                            No posts yet!
                        </div>
                    )}

                    {/* Infinite scroll sentinel */}
                    {posts.length > 0 && (
                        <div
                            ref={loadMoreRef}
                            className="py-6 text-center text-xs text-gray-400 dark:text-gray-300"
                        >
                            {isLoadingMore
                                ? "Loading more posts..."
                                : hasMore
                                    ? "Scroll to load more"
                                    : "No more posts"}
                        </div>
                    )}
                </div>
            </div>

            {/* ---------------- Share Modal ---------------- */}
            {sharePostId && (
                <div
                    className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
                    onClick={() => setSharePostId(null)}
                >
                    <div
                        className="w-[680px] max-w-[94vw] rounded-xl bg-white p-5 shadow-xl dark:border dark:border-white/10 dark:bg-neutral-900 dark:shadow-none"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Share post</div>
                            <button
                                className="text-gray-500 hover:text-black dark:text-gray-300 dark:hover:text-white"
                                onClick={() => setSharePostId(null)}
                                title="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Search for people (followers) to start a new DM */}
                        <div className="mb-3">
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search
                                        size={16}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                                    />
                                    <input
                                        className="w-full pl-8 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30 dark:border-white/10 dark:bg-transparent dark:text-gray-100"
                                        placeholder="Search followers to start a new chat…"
                                        value={shareQuery}
                                        onChange={(e) => setShareQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            {shareQuery && (
                                <div className="mt-2 border rounded-md max-h-40 overflow-y-auto divide-y dark:border-white/10 dark:divide-white/5">
                                    {shareSearching ? (
                                        <div className="p-2 text-sm text-gray-500 dark:text-gray-300">
                                            Searching…
                                        </div>
                                    ) : shareResults.length === 0 ? (
                                        <div className="p-2 text-sm text-gray-400 dark:text-gray-300">
                                            No matches
                                        </div>
                                    ) : (
                                        shareResults.map((u) => (
                                            <button
                                                key={u.id}
                                                className="w-full text-left p-2 text-sm hover:bg-gray-50 flex items-center gap-2 dark:hover:bg-white/5 text-gray-700 dark:text-gray-100"
                                                onClick={() => onPickUserToShare(u)}
                                                title={`Share with ${displayName(u)}`}
                                            >
                                                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] uppercase dark:bg-white/10 dark:text-white">
                                                    {(u.username || u.name || "U").slice(0, 2)}
                                                </div>
                                                <div className="truncate">
                                                    {displayName(u)}
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-gray-100 my-3 dark:bg-white/10" />

                        {/* Existing conversations */}
                        <div>
                            <div className="text-xs text-gray-500 mb-2 dark:text-gray-300">
                                Or share to an existing conversation
                            </div>
                            <div className="border rounded-md max-h-72 overflow-y-auto divide-y dark:border-white/10 dark:divide-white/5">
                                {convosLoading ? (
                                    <div className="p-3 text-sm text-gray-500 dark:text-gray-300">
                                        Loading conversations…
                                    </div>
                                ) : convosError ? (
                                    <div className="p-3 text-sm text-red-500">
                                        {convosError}
                                    </div>
                                ) : convos.length === 0 ? (
                                    <div className="p-3 text-sm text-gray-400 dark:text-gray-300">
                                        No conversations yet.
                                    </div>
                                ) : (
                                    convos.map((c) => {
                                        const title = conversationTitle(c);
                                        const isGroup =
                                            c.isGroup &&
                                            ((c.groupMembers?.length ?? 0) >= 2);
                                        const initials = isGroup
                                            ? "G"
                                            : (c.other?.username ||
                                                c.other?.name ||
                                                "U"
                                            ).slice(0, 2);
                                        const preview = c.lastMessage?.content?.trim()
                                            ? c.lastMessage.content
                                            : (c.lastMessage?.imageUrls?.length ?? 0) > 0
                                                ? "📷 Photo"
                                                : "No messages yet";
                                        return (
                                            <button
                                                key={c.id}
                                                className="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3 dark:hover:bg-white/5"
                                                onClick={() => onPickConversationToShare(c)}
                                                title={`Share with ${title}`}
                                            >
                                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs uppercase dark:bg-white/10 dark:text-white">
                                                    {initials}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">
                                                        {title}
                                                    </div>
                                                    <div className="text-xs text-gray-500 truncate dark:text-gray-400">
                                                        {preview}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
