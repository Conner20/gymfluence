// components/PostDetail.tsx
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

export default function PostDetail({ postId }: { postId: string }) {
    const router = useRouter();
    const { data: session } = useSession();

    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorCode, setErrorCode] = useState<"NOT_FOUND" | "PRIVATE" | "GENERIC" | null>(null);

    // If post is private and viewer can't see it, we try to capture author info for a follow link.
    const [privateInfo, setPrivateInfo] = useState<{ username?: string | null; id?: string | null } | null>(null);

    // Share modal
    const [shareOpen, setShareOpen] = useState(false);
    const [convos, setConvos] = useState<ConversationRow[]>([]);
    const [convosLoading, setConvosLoading] = useState(false);
    const [convosError, setConvosError] = useState<string | null>(null);

    const [shareQuery, setShareQuery] = useState("");
    const [shareResults, setShareResults] = useState<LiteUser[]>([]);
    const [shareSearching, setShareSearching] = useState(false);

    const canShare = useMemo(() => !!session, [session]);

    const fetchPost = async () => {
        setErrorCode(null);
        setPrivateInfo(null);
        setLoading(true);
        try {
            const res = await fetch(`/api/posts/${encodeURIComponent(postId)}`, { cache: "no-store" });

            if (res.status === 404) {
                setPost(null);
                setErrorCode("NOT_FOUND");
                return;
            }

            if (res.status === 403) {
                // Try to glean author identifiers from the response body if the API provides them
                const data = await res.json().catch(() => ({} as any));
                const authorUsername =
                    data?.author?.username ?? data?.authorUsername ?? null;
                const authorId = data?.author?.id ?? data?.authorId ?? null;
                setPrivateInfo({ username: authorUsername, id: authorId });
                setPost(null);
                setErrorCode("PRIVATE");
                return;
            }

            if (!res.ok) throw new Error();

            const data: Post = await res.json();
            setPost(data);
        } catch {
            setErrorCode("GENERIC");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPost();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [postId]);

    // Auto-size when embedded in an iframe (Messenger preview)
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window === window.parent) return; // not embedded

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
            if (res.status === 401) {
                alert("Sign in to like posts.");
                return;
            }
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
                const res = await fetch(`/api/messages/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
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

    const displayName = (u?: LiteUser | null) => u?.username || u?.name || "User";
    const conversationTitle = (c: ConversationRow) => {
        const realGroup = c.isGroup && ((c.groupMembers?.length ?? 0) >= 2);
        if (realGroup) return c.groupName || "Group";
        return displayName(c.other);
    };

    const onPickConversationToShare = (c: ConversationRow) => {
        if (!post) return;
        const realGroup = c.isGroup && ((c.groupMembers?.length ?? 0) >= 2);
        if (realGroup) {
            router.push(`/messages?convoId=${encodeURIComponent(c.id)}&shareType=post&shareId=${encodeURIComponent(post.id)}`);
        } else if (c.other) {
            const pretty = c.other.username || c.other.id;
            router.push(`/messages?to=${encodeURIComponent(pretty)}&shareType=post&shareId=${encodeURIComponent(post.id)}`);
        } else {
            router.push(`/messages?convoId=${encodeURIComponent(c.id)}&shareType=post&shareId=${encodeURIComponent(post.id)}`);
        }
        setShareOpen(false);
    };

    const onPickUserToShare = (u: LiteUser) => {
        if (!post) return;
        const pretty = u.username || u.id;
        router.push(`/messages?to=${encodeURIComponent(pretty)}&shareType=post&shareId=${encodeURIComponent(post.id)}`);
        setShareOpen(false);
    };

    if (loading) return <div className="text-gray-500 p-8">Loading post…</div>;

    // ——— Tailored PRIVATE message with a direct link to the author's profile to request follow ———
    if (errorCode === "PRIVATE") {
        const slug = privateInfo?.username || privateInfo?.id || null;
        return (
            <div className="w-full max-w-lg mx-auto px-4">
                <div className="bg-white rounded-2xl shadow p-6 text-center">
                    <h2 className="font-semibold text-lg text-gray-800">This post is private</h2>
                    <p className="text-sm text-gray-600 mt-2">
                        You don't have permission to view this post because the author's account is private.
                    </p>
                    {slug ? (
                        <div className="mt-4">
                            <Link
                                href={`/u/${encodeURIComponent(slug)}`}
                                className="inline-block px-4 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-black"
                            >
                                Visit profile to request follow
                            </Link>
                            <p className="text-xs text-gray-500 mt-2">
                                Send a follow request. Once accepted, you'll be able to view this post.
                            </p>
                        </div>
                    ) : (
                        <p className="text-xs text-gray-500 mt-3">
                            Ask the sender to share the author's profile so you can request to follow them.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    if (errorCode === "NOT_FOUND") return <div className="text-red-500 p-8">Post not found.</div>;
    if (errorCode === "GENERIC") return <div className="text-red-500 p-8">Failed to load post.</div>;
    if (!post) return null;

    return (
        <>
            <div className="w-full max-w-2xl mx-auto px-4">
                <article className="bg-white rounded-2xl shadow-lg px-6 py-5">
                    <div className="flex flex-col gap-1 mb-2">
                        <h2 className="font-bold text-2xl text-gray-800">{post.title}</h2>
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

                    {post.content && <div className="text-gray-700 mt-2 whitespace-pre-wrap">{post.content}</div>}

                    {post.imageUrl && (
                        <div className="mt-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={post.imageUrl}
                                alt={post.title}
                                className="w-full max-h-[640px] object-contain rounded-xl border"
                            />
                        </div>
                    )}

                    <div id="comments" className="mt-6">
                        <PostComments postId={post.id} />
                    </div>
                </article>
            </div>

            {/* Share modal */}
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
                                                onClick={() => onPickUserToShare(u)}
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
                                        const title = conversationTitle(c);
                                        const isGroup = c.isGroup && ((c.groupMembers?.length ?? 0) >= 2);
                                        const initials = isGroup ? "G" : (c.other?.username || c.other?.name || "U").slice(0, 2);
                                        const preview = c.lastMessage?.content?.trim()
                                            ? c.lastMessage.content
                                            : (c.lastMessage?.imageUrls?.length ?? 0) > 0
                                                ? "📷 Photo"
                                                : "No messages yet";
                                        return (
                                            <button
                                                key={c.id}
                                                className="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3"
                                                onClick={() => onPickConversationToShare(c)}
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
