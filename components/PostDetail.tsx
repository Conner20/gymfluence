'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Heart, MessageCircle, Share2, X, Search } from "lucide-react";
import clsx from "clsx";
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

type Comment = {
    id: string;
    content: string;
    createdAt: string;
    author: { username: string | null; email: string | null } | null;
    replies: Comment[];
};

type Post = {
    id: string;
    title: string;
    content: string;
    imageUrl?: string | null;
    createdAt: string;
    author: { id: string; username: string | null; name: string | null } | null;
    likeCount?: number;            // <- optional
    didLike?: boolean;             // <- optional
    commentCount?: number;         // <- optional
    comments?: Comment[];
};

export default function PostDetail({
    postId,
    flat = false,
}: {
    postId: string;
    flat?: boolean;
}) {
    const router = useRouter();
    const { data: session } = useSession();

    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showComments, setShowComments] = useState(() => !flat);
    const [copied, setCopied] = useState(false);

    // Share modal
    const [shareOpen, setShareOpen] = useState(false);
    const [convos, setConvos] = useState<ConversationRow[]>([]);
    const [convosLoading, setConvosLoading] = useState(false);
    const [convosError, setConvosError] = useState<string | null>(null);

    const [shareQuery, setShareQuery] = useState("");
    const [shareResults, setShareResults] = useState<LiteUser[]>([]);
    const [shareSearching, setShareSearching] = useState(false);

    const canShare = useMemo(() => !!session, [session]);
    const viewerUsername = session?.user?.username ?? null;

    const fetchPost = async () => {
        setError(null);
        setLoading(true);
        try {
            const res = await fetch(
                `/api/posts/${encodeURIComponent(postId)}`,
                { cache: "no-store" }
            );
            if (res.status === 404) {
                setError("Post not found or not visible.");
                setPost(null);
                return;
            }
            if (!res.ok) throw new Error();
            const data: Post = await res.json();
            setPost(data);
        } catch {
            setError("Failed to load post.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPost();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [postId]);

    // Auto-size when embedded in iframe (Messenger preview)
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window === window.parent) return;

        const sendSize = () => {
            const h = document.documentElement.scrollHeight;
            window.parent.postMessage(
                { type: "post-embed-size", height: h },
                window.location.origin
            );
        };
        sendSize();
        const ro = new ResizeObserver(() => sendSize());
        ro.observe(document.body);
        const onLoad = () => sendSize();
        window.addEventListener("load", onLoad);
        return () => {
            ro.disconnect();
            window.removeEventListener("load", onLoad);
        };
    }, []);

    useEffect(() => {
        setShowComments(!flat);
    }, [postId, flat]);

    const handleLike = async () => {
        if (!session) return;

        setPost(prev => {
            if (!prev) return prev;

            const wasLiked = !!prev.didLike;
            const prevCount = prev.likeCount ?? 0;

            return {
                ...prev,
                didLike: !wasLiked,
                likeCount: prevCount + (wasLiked ? -1 : 1),
            };
        });

        try {
            const res = await fetch(
                `/api/posts/${encodeURIComponent(postId)}/like`,
                { method: "POST" }
            );
            if (!res.ok) throw new Error();
            // Optional: re-sync with server if you want exact counts
            // fetchPost();
        } catch {
            // rollback
            setPost(prev => {
                if (!prev) return prev;

                const wasLiked = !!prev.didLike;
                const prevCount = prev.likeCount ?? 0;

                return {
                    ...prev,
                    didLike: !wasLiked,
                    likeCount: prevCount + (wasLiked ? -1 : 1),
                };
            });
            alert("Failed to like/unlike post.");
        }
    };

    const toggleComments = () => {
        setShowComments((prev) => {
            const next = !prev;
            if (next && typeof window !== "undefined") {
                window.requestAnimationFrame(() => {
                    document
                        .getElementById("comments")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
            }
            return next;
        });
    };


    const openShare = async () => {
        setShareOpen(true);
        setConvosError(null);
        setConvosLoading(true);
        try {
            const res = await fetch("/api/messages/conversations", {
                cache: "no-store",
            });
            if (!res.ok) throw new Error();
            const data: ConversationRow[] = await res.json();
            setConvos(data);
        } catch {
            setConvosError("Failed to load conversations.");
        } finally {
            setConvosLoading(false);
        }
    };

    useEffect(() => {
        const q = shareQuery.trim();
        if (!shareOpen) return;
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
    }, [shareQuery, shareOpen]);

    const displayName = (u?: LiteUser | null) =>
        u?.username || u?.name || "User";

    if (loading) return <div className="text-gray-500 p-8">Loading post…</div>;
    if (error) return <div className="text-red-500 p-8">{error}</div>;
    if (!post) return null;

    // ---- shared formatting helpers ----
    const isFlat = !!flat;
    const authorUsername = post.author?.username ?? null;
    const authorLink =
        authorUsername ? (
            authorUsername === viewerUsername ? (
                <Link
                    href="/profile"
                    className="font-semibold hover:underline"
                    title="View your profile"
                >
                    {authorUsername}
                </Link>
            ) : (
                <Link
                    href={`/u/${encodeURIComponent(authorUsername)}`}
                    className="font-semibold hover:underline"
                    title={`View ${authorUsername}'s profile`}
                >
                    {authorUsername}
                </Link>
            )
        ) : (
            <span className="font-semibold">Unknown</span>
        );

    const authorBits = (
        <>
            <span className="text-xs text-gray-500 dark:text-gray-300">by {authorLink}</span>
            <span
                className="text-xs text-gray-400 dark:text-gray-300"
                title={new Date(post.createdAt).toLocaleString()}
            >
                {formatRelativeTime(post.createdAt)}
            </span>
        </>
    );

    const actionButtons = (
        <>
            <button
                type="button"
                className={clsx(
                    "flex items-center gap-1 text-xs transition",
                    post.didLike
                        ? "text-red-500 font-bold"
                        : "text-gray-400 hover:text-red-500 dark:text-gray-300 dark:hover:text-red-500"
                )}
                onClick={handleLike}
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
                type="button"
                className={clsx(
                    "flex items-center gap-1 text-xs transition",
                    showComments
                        ? "text-green-700 font-semibold"
                        : "text-gray-400 hover:text-green-700 dark:text-gray-300 dark:hover:text-green-500"
                )}
                onClick={toggleComments}
                title={showComments ? "Hide comments" : "Show comments"}
            >
                <MessageCircle size={16} />
                {post.commentCount ?? 0}
            </button>

            <button
                type="button"
                className={clsx(
                    "flex items-center gap-1 text-xs transition",
                    isFlat
                        ? "text-gray-400 hover:text-green-700 dark:text-gray-300 dark:hover:text-green-500"
                        : canShare
                            ? "text-gray-400 hover:text-green-700 dark:text-gray-300 dark:hover:text-green-500"
                            : "text-gray-300 cursor-not-allowed dark:text-gray-600"
                )}
                onClick={async () => {
                    if (isFlat) {
                        const origin = typeof window !== "undefined" ? window.location.origin : "";
                        const url = `${origin}/post/${encodeURIComponent(post.id)}`;
                        try {
                            await navigator.clipboard.writeText(url);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                        } catch {
                            setCopied(false);
                        }
                        return;
                    }
                    if (!canShare) return;
                    await openShare();
                }}
                disabled={!isFlat && !canShare}
                title={
                    isFlat
                        ? "Copy share link"
                        : canShare
                            ? "Share via Messenger"
                            : "Sign in to share"
                }
            >
                <Share2 size={16} />
                {copied && isFlat ? "Copied" : "Share"}
            </button>
        </>
    );

    const outerCls = isFlat
        ? "w-full max-w-xl mx-auto text-gray-900 dark:text-gray-100"
        : "w-full max-w-2xl mx-auto px-1 sm:px-3 text-gray-900 dark:text-gray-100";
    const articleCls = clsx(
        "bg-white rounded-2xl shadow-lg py-5 dark:bg-neutral-900 dark:border dark:border-white/10 dark:shadow-none",
        isFlat ? "px-6" : "px-3 sm:px-5"
    );
    const titleCls = isFlat
        ? "font-bold text-lg text-gray-800 dark:text-white"
        : "font-bold text-2xl text-gray-900 dark:text-white";
    const textCls = "text-gray-700 mt-2 whitespace-pre-wrap dark:text-gray-200";
    const imageCls = isFlat
        ? "w-full max-h-[540px] object-contain rounded-xl border dark:border-white/10"
        : "w-full max-h-[640px] object-contain rounded-xl border dark:border-white/10";
    const commentsWrapperCls = isFlat ? "mt-3" : "mt-6";

    return (
        <>
            <div className={outerCls}>
                <article className={articleCls}>
                    <div className="flex flex-col gap-1 mb-2">
                        {isFlat ? (
                            <span className={titleCls}>{post.title}</span>
                        ) : (
                            <h2 className={titleCls}>{post.title}</h2>
                        )}
                        <div className="flex flex-wrap items-center gap-2 md:hidden">
                            {authorBits}
                        </div>
                        <div className="hidden md:flex flex-wrap items-center gap-3">
                            {authorBits}
                            <div className="flex flex-wrap items-center gap-4">
                                {actionButtons}
                            </div>
                        </div>
                        <div className="mt-2 flex md:hidden flex-wrap items-center gap-4">
                            {actionButtons}
                        </div>
                    </div>

                    {post.content && <div className={textCls}>{post.content}</div>}

                    {post.imageUrl && (
                        <div className="mt-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={post.imageUrl} alt={post.title} className={imageCls} />
                        </div>
                    )}

                    {showComments && (
                        <div id="comments" className={commentsWrapperCls}>
                            <PostComments postId={post.id} />
                        </div>
                    )}
                </article>
            </div>

            {/* (Share modal unchanged) */}
            {shareOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
                    onClick={() => setShareOpen(false)}
                >
                    <div
                        className="bg-white rounded-xl shadow-xl w-[680px] max-w-[94vw] p-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-lg font-semibold">Share post</div>
                            <button
                                className="text-gray-500 hover:text-black"
                                onClick={() => setShareOpen(false)}
                                title="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="mb-3">
                            <div className="relative">
                                <Search
                                    size={16}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
                                />
                                <input
                                    className="w-full pl-8 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                                    placeholder="Search followers to start a new chat…"
                                    value={shareQuery}
                                    onChange={(e) => setShareQuery(e.target.value)}
                                />
                            </div>
                            {shareQuery && (
                                <div className="mt-2 border rounded-md max-h-40 overflow-y-auto divide-y">
                                    {shareSearching ? (
                                        <div className="p-2 text-sm text-gray-500">Searching…</div>
                                    ) : shareResults.length === 0 ? (
                                        <div className="p-2 text-sm text-gray-400">No matches</div>
                                    ) : (
                                        shareResults.map((u) => (
                                            <button
                                                key={u.id}
                                                className="w-full text-left p-2 text-sm hover:bg-gray-50 flex items.center gap-2"
                                                onClick={() => {
                                                    const pretty = u.username || u.id;
                                                    router.push(
                                                        `/messages?to=${encodeURIComponent(
                                                            pretty
                                                        )}&shareType=profile&shareUrl=${encodeURIComponent(
                                                            `${window.location.origin}/u/${pretty}`
                                                        )}&shareLabel=${encodeURIComponent(
                                                            displayName(u)
                                                        )}&shareUserId=${encodeURIComponent(u.id)}`
                                                    );
                                                    setShareOpen(false);
                                                }}
                                                title={`Share with ${displayName(u)}`}
                                            >
                                                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] uppercase">
                                                    {(u.username || u.name || "U").slice(0, 2)}
                                                </div>
                                                <div className="truncate">{displayName(u)}</div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="h-px bg-gray-100 my-3" />

                        <div>
                            <div className="text-xs text-gray-500 mb-2">
                                Or share to an existing conversation
                            </div>
                            <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
                                {convosLoading ? (
                                    <div className="p-3 text-sm text-gray-500">
                                        Loading conversations…
                                    </div>
                                ) : convosError ? (
                                    <div className="p-3 text-sm text-red-500">
                                        {convosError}
                                    </div>
                                ) : convos.length === 0 ? (
                                    <div className="p-3 text-sm text-gray-400">
                                        No conversations yet.
                                    </div>
                                ) : (
                                    convos.map((c) => {
                                        const isGroup =
                                            c.isGroup && ((c.groupMembers?.length ?? 0) >= 2);
                                        const title = isGroup
                                            ? c.groupName || "Group"
                                            : c.other?.username || c.other?.name || "User";
                                        const initials = isGroup
                                            ? "G"
                                            : (c.other?.username || c.other?.name || "U").slice(
                                                0,
                                                2
                                            );
                                        const preview = c.lastMessage?.content?.trim()
                                            ? c.lastMessage.content
                                            : (c.lastMessage?.imageUrls?.length ?? 0) > 0
                                                ? "📷 Photo"
                                                : "No messages yet";
                                        return (
                                            <button
                                                key={c.id}
                                                className="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3"
                                                onClick={() => {
                                                    const pretty = c.other?.username || c.other?.id || "";
                                                    if (isGroup || !pretty) {
                                                        router.push(
                                                            `/messages?convoId=${encodeURIComponent(
                                                                c.id
                                                            )}&shareType=post&shareId=${encodeURIComponent(
                                                                post.id
                                                            )}`
                                                        );
                                                    } else {
                                                        router.push(
                                                            `/messages?to=${encodeURIComponent(
                                                                pretty
                                                            )}&shareType=post&shareId=${encodeURIComponent(
                                                                post.id
                                                            )}`
                                                        );
                                                    }
                                                    setShareOpen(false);
                                                }}
                                                title={`Share with ${title}`}
                                            >
                                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs uppercase">
                                                    {initials}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-medium truncate">
                                                        {title}
                                                    </div>
                                                    <div className="text-xs text-gray-500 truncate">
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
