'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Heart, MessageCircle, Share2, X, Search } from "lucide-react";
import clsx from "clsx";
import { PostComments } from "@/components/PostComments";

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
    likeCount: number;
    didLike: boolean;
    commentCount: number;
    comments?: Comment[];
};

export default function PostDetail({
    postId,
    flat = false, // NEW: render “flat” (no card) when embedded inside profile view
}: {
    postId: string;
    flat?: boolean;
}) {
    const router = useRouter();
    const { data: session } = useSession();

    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Share modal
    const [shareOpen, setShareOpen] = useState(false);
    const [convos, setConvos] = useState<ConversationRow[]>([]);
    const [convosLoading, setConvosLoading] = useState(false);
    const [convosError, setConvosError] = useState<string | null>(null);

    const [shareQuery, setShareQuery] = useState('');
    const [shareResults, setShareResults] = useState<LiteUser[]>([]);
    const [shareSearching, setShareSearching] = useState(false);

    const canShare = useMemo(() => !!session, [session]);

    const fetchPost = async () => {
        setError(null);
        setLoading(true);
        try {
            const res = await fetch(`/api/posts/${encodeURIComponent(postId)}`, { cache: "no-store" });
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
            window.parent.postMessage({ type: "post-embed-size", height: h }, window.location.origin);
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

    const handleLike = async () => {
        if (!post) return;
        try {
            const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}/like`, { method: "POST" });
            if (!res.ok) throw new Error();
            fetchPost();
        } catch {
            alert("Failed to like/unlike post.");
        }
    };

    const openShare = async () => {
        setShareOpen(true);
        setConvosError(null);
        setConvosLoading(true);
        try {
            const res = await fetch('/api/messages/conversations', { cache: 'no-store' });
            if (!res.ok) throw new Error();
            const data: ConversationRow[] = await res.json();
            setConvos(data);
        } catch {
            setConvosError('Failed to load conversations.');
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
                const res = await fetch(`/api/messages/search?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
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

    const displayName = (u?: LiteUser | null) => u?.username || u?.name || 'User';

    if (loading) return <div className="text-gray-500 p-8">Loading post…</div>;
    if (error) return <div className="text-red-500 p-8">{error}</div>;
    if (!post) return null;

    // ---- width & card style toggles ----
    const outerCls = flat
        ? "w-full max-w-[1100px] mx-auto "
        : "w-full max-w-2xl mx-auto px-4";

    const articleCls = flat
        ? "px-0"
        : "bg-white rounded-2xl shadow-lg px-6 py-5";

    const imageCls = flat
        ? "w-full h-auto rounded-xl"
        : "w-full max-h-[640px] object-contain rounded-xl border";

    return (
        <>
            <div className={outerCls}>
                <article className={articleCls}>
                    <div className="flex flex-col gap-1 mb-2">
                        <h2 className={clsx("font-bold text-2xl", flat ? "text-gray-900" : "text-gray-800")}>
                            {post.title}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-gray-500">
                                by{" "}
                                {post.author?.username ? (
                                    <Link
                                        href={`/u/${encodeURIComponent(post.author.username)}`}
                                        className="font-semibold hover:underline"
                                        title={`View ${post.author.username}'s profile`}
                                    >
                                        {post.author.username}
                                    </Link>
                                ) : (
                                    <span className="font-semibold">Unknown</span>
                                )}
                            </span>
                            <span className="text-xs text-gray-400">· {new Date(post.createdAt).toLocaleString()}</span>

                            <button
                                className={clsx(
                                    "flex items-center ml-3 gap-1 text-xs transition",
                                    post.didLike ? "text-red-500 font-bold" : "text-gray-400 hover:text-red-400"
                                )}
                                onClick={handleLike}
                                title={post.didLike ? "Unlike" : "Like"}
                            >
                                <Heart size={18} fill={post.didLike ? "currentColor" : "none"} strokeWidth={2} />
                                {post.likeCount}
                            </button>

                            <a
                                href="#comments"
                                className="flex items-center gap-1 text-xs ml-2 text-gray-400 hover:text-green-600"
                                title="Jump to comments"
                            >
                                <MessageCircle size={16} />
                                {post.commentCount}
                            </a>

                            <button
                                className={clsx(
                                    "flex items-center gap-1 text-xs ml-2 transition",
                                    canShare ? "text-gray-500 hover:text-green-700" : "text-gray-300 cursor-not-allowed"
                                )}
                                onClick={() => canShare && openShare()}
                                disabled={!canShare}
                                title={canShare ? "Share via Messenger" : "Sign in to share"}
                            >
                                <Share2 size={16} />
                                Share
                            </button>
                        </div>
                    </div>

                    {post.content && (
                        <div className={clsx("text-gray-700 mt-2 whitespace-pre-wrap", flat && "px-0")}>
                            {post.content}
                        </div>
                    )}

                    {post.imageUrl && (
                        <div className="mt-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={post.imageUrl} alt={post.title} className={imageCls} />
                        </div>
                    )}

                    <div id="comments" className={clsx("mt-6", flat && "px-0")}>
                        <PostComments postId={post.id} />
                    </div>
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
                            <button className="text-gray-500 hover:text-black" onClick={() => setShareOpen(false)} title="Close">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="mb-3">
                            <div className="relative">
                                <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
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
                                                className="w-full text-left p-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                                                onClick={() => {
                                                    const pretty = u.username || u.id;
                                                    router.push(`/messages?to=${encodeURIComponent(pretty)}&shareType=profile&shareUrl=${encodeURIComponent(
                                                        `${window.location.origin}/u/${pretty}`
                                                    )}&shareLabel=${encodeURIComponent(displayName(u))}&shareUserId=${encodeURIComponent(u.id)}`);
                                                    setShareOpen(false);
                                                }}
                                                title={`Share with ${displayName(u)}`}
                                            >
                                                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] uppercase">
                                                    {(u.username || u.name || 'U').slice(0, 2)}
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
                            <div className="text-xs text-gray-500 mb-2">Or share to an existing conversation</div>
                            <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
                                {convosLoading ? (
                                    <div className="p-3 text-sm text-gray-500">Loading conversations…</div>
                                ) : convosError ? (
                                    <div className="p-3 text-sm text-red-500">{convosError}</div>
                                ) : convos.length === 0 ? (
                                    <div className="p-3 text-sm text-gray-400">No conversations yet.</div>
                                ) : (
                                    convos.map((c) => {
                                        const isGroup = c.isGroup && ((c.groupMembers?.length ?? 0) >= 2);
                                        const title = isGroup ? (c.groupName || 'Group') : (c.other?.username || c.other?.name || 'User');
                                        const initials = isGroup ? 'G' : (c.other?.username || c.other?.name || 'U').slice(0, 2);
                                        const preview =
                                            c.lastMessage?.content?.trim()
                                                ? c.lastMessage.content
                                                : (c.lastMessage?.imageUrls?.length ?? 0) > 0
                                                    ? '📷 Photo'
                                                    : 'No messages yet';
                                        return (
                                            <button
                                                key={c.id}
                                                className="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3"
                                                onClick={() => {
                                                    const pretty = c.other?.username || c.other?.id || "";
                                                    if (isGroup || !pretty) {
                                                        router.push(`/messages?convoId=${encodeURIComponent(c.id)}&shareType=post&shareId=${encodeURIComponent(post.id)}`);
                                                    } else {
                                                        router.push(`/messages?to=${encodeURIComponent(pretty)}&shareType=post&shareId=${encodeURIComponent(post.id)}`);
                                                    }
                                                    setShareOpen(false);
                                                }}
                                                title={`Share with ${title}`}
                                            >
                                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs uppercase">
                                                    {initials}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-medium truncate">{title}</div>
                                                    <div className="text-xs text-gray-500 truncate">{preview}</div>
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
