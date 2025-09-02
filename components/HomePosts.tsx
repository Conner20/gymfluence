'use client';

import { useEffect, useMemo, useState } from "react";
import { Trash2, Heart, MessageCircle, CornerDownRight, Share2, X, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Comment = {
    id: string;
    content: string;
    createdAt: string;
    author: { username: string | null, email: string | null } | null;
    replies: Comment[];
};

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
    author: { username: string | null, email: string | null } | null;
    likeCount: number;
    didLike: boolean;
    commentCount: number;
    comments: Comment[];
};

export default function HomePosts({ initialPosts }: { initialPosts?: Post[] }) {
    const router = useRouter();
    const { data: session } = useSession();
    const username = session?.user?.username;

    const [posts, setPosts] = useState<Post[]>(initialPosts ?? []);
    const [loading, setLoading] = useState<boolean>(!initialPosts);
    const [error, setError] = useState<string | null>(null);

    const [openComments, setOpenComments] = useState<{ [postId: string]: boolean }>({});
    const [newComment, setNewComment] = useState<{ [postId: string]: string }>({});
    const [replying, setReplying] = useState<{ [commentId: string]: boolean }>({});
    const [replyContent, setReplyContent] = useState<{ [commentId: string]: string }>({});

    // SHARE MODAL STATE
    const [sharePostId, setSharePostId] = useState<string | null>(null);
    const [convos, setConvos] = useState<ConversationRow[]>([]);
    const [convosLoading, setConvosLoading] = useState(false);
    const [convosError, setConvosError] = useState<string | null>(null);

    const [shareQuery, setShareQuery] = useState('');
    const [shareResults, setShareResults] = useState<LiteUser[]>([]);
    const [shareSearching, setShareSearching] = useState(false);

    const hasSession = !!session;

    const fetchPosts = async () => {
        setError(null);
        try {
            const res = await fetch("/api/posts", { cache: "no-store" });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setPosts(data);
        } catch {
            setError("Failed to fetch posts.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (initialPosts) return; // already provided
        setLoading(true);
        fetchPosts();
        const interval = setInterval(fetchPosts, 3000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDelete = async (id: string) => {
        if (!window.confirm("Delete this post?")) return;
        try {
            const res = await fetch("/api/posts", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) throw new Error();
            setPosts(p => p.filter(post => post.id !== id));
        } catch {
            alert("Failed to delete post.");
        }
    };

    const handleLike = async (id: string) => {
        try {
            const res = await fetch(`/api/posts/${id}/like`, { method: "POST" });
            if (!res.ok) throw new Error();
            fetchPosts();
        } catch {
            alert("Failed to like/unlike post.");
        }
    };

    const toggleComments = (postId: string) => {
        setOpenComments(prev => ({ ...prev, [postId]: !prev[postId] }));
    };

    const handleAddComment = async (postId: string) => {
        if (!newComment[postId]?.trim()) return;
        try {
            const res = await fetch(`/api/posts/${postId}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: newComment[postId] }),
            });
            if (!res.ok) throw new Error();
            setNewComment(prev => ({ ...prev, [postId]: "" }));
            fetchPosts();
        } catch {
            alert("Failed to add comment.");
        }
    };

    const handleAddReply = async (postId: string, commentId: string) => {
        if (!replyContent[commentId]?.trim()) return;
        try {
            const res = await fetch(`/api/posts/${postId}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: replyContent[commentId], parentId: commentId }),
            });
            if (!res.ok) throw new Error();
            setReplyContent(prev => ({ ...prev, [commentId]: "" }));
            setReplying(prev => ({ ...prev, [commentId]: false }));
            fetchPosts();
        } catch {
            alert("Failed to reply.");
        }
    };

    // -------- Share modal helpers --------
    const openShareModal = async (postId: string) => {
        setSharePostId(postId);
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
    }, [shareQuery, sharePostId]);

    const displayName = (u?: LiteUser | null) => u?.username || u?.name || 'User';

    const conversationTitle = (c: ConversationRow) => {
        const realGroup = c.isGroup && ((c.groupMembers?.length ?? 0) >= 2);
        if (realGroup) return c.groupName || 'Group';
        return displayName(c.other);
    };

    const onPickConversationToShare = (c: ConversationRow) => {
        if (!sharePostId) return;
        const realGroup = c.isGroup && ((c.groupMembers?.length ?? 0) >= 2);
        if (realGroup) {
            router.push(`/messages?convoId=${encodeURIComponent(c.id)}&shareType=post&shareId=${encodeURIComponent(sharePostId)}`);
        } else if (c.other) {
            const pretty = c.other.username || c.other.id;
            router.push(`/messages?to=${encodeURIComponent(pretty)}&shareType=post&shareId=${encodeURIComponent(sharePostId)}`);
        } else {
            router.push(`/messages?convoId=${encodeURIComponent(c.id)}&shareType=post&shareId=${encodeURIComponent(sharePostId)}`);
        }
        setSharePostId(null);
    };

    const onPickUserToShare = (u: LiteUser) => {
        if (!sharePostId) return;
        const pretty = u.username || u.id;
        router.push(`/messages?to=${encodeURIComponent(pretty)}&shareType=post&shareId=${encodeURIComponent(sharePostId)}`);
        setSharePostId(null);
    };

    const renderComments = (comments: Comment[], postId: string, depth = 0) => (
        <div className={depth === 0 ? "mt-4" : "ml-6 mt-3"}>
            {comments.map(comment => (
                <div key={comment.id} className="mb-2">
                    <div className="flex items-center gap-2">
                        {comment.author?.username ? (
                            comment.author.username === username ? (
                                <Link href="/profile" className="text-sm font-semibold text-gray-700 hover:underline" title="View your profile">
                                    {comment.author.username}
                                </Link>
                            ) : (
                                <Link
                                    href={`/u/${encodeURIComponent(comment.author.username)}`}
                                    className="text-sm font-semibold text-gray-700 hover:underline"
                                    title={`View ${comment.author.username}'s profile`}
                                >
                                    {comment.author.username}
                                </Link>
                            )
                        ) : (
                            <span className="text-sm font-semibold text-gray-700">Unknown</span>
                        )}
                        <span className="text-xs text-gray-400">{new Date(comment.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="text-gray-800 ml-1">{comment.content}</div>
                    <div className="flex gap-2 items-center mt-1">
                        <button
                            className="text-xs text-gray-500 hover:text-green-700 flex items-center gap-1"
                            onClick={() => setReplying(r => ({ ...r, [comment.id]: !r[comment.id] }))}
                        >
                            <CornerDownRight size={14} />
                            Reply
                        </button>
                        {replying[comment.id] && (
                            <form onSubmit={e => { e.preventDefault(); handleAddReply(postId, comment.id); }} className="flex gap-1 mt-1">
                                <input
                                    className="border rounded px-2 py-1 text-xs"
                                    placeholder="Write a reply..."
                                    value={replyContent[comment.id] || ""}
                                    onChange={e => setReplyContent(r => ({ ...r, [comment.id]: e.target.value }))}
                                />
                                <button className="bg-green-600 text-white px-2 py-1 rounded text-xs" type="submit">Send</button>
                            </form>
                        )}
                    </div>
                    {comment.replies && comment.replies.length > 0 && renderComments(comment.replies, postId, depth + 1)}
                </div>
            ))}
        </div>
    );

    const canShare = useMemo(() => !!session, [session]);

    if (loading) return <div className="text-gray-500 p-8">Loading posts...</div>;
    if (error) return <div className="text-red-500 p-8">{error}</div>;

    return (
        <>
            <div className="w-full max-w-xl mx-auto mt-6">
                <div className="space-y-6">
                    {posts.map(post => (
                        <div key={post.id} className="relative bg-white rounded-2xl shadow-lg px-6 py-5">
                            {post.author?.username === username && (
                                <button
                                    onClick={() => handleDelete(post.id)}
                                    className="absolute right-4 top-4 text-gray-300 hover:text-red-500 transition"
                                    title="Delete post"
                                >
                                    <Trash2 size={20} />
                                </button>
                            )}

                            <div className="flex flex-col gap-1 mb-2">
                                <span className="font-bold text-lg text-gray-800">{post.title}</span>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-gray-500">
                                        by{" "}
                                        {post.author?.username ? (
                                            post.author.username === username ? (
                                                <Link href="/profile" className="font-semibold hover:underline" title="View your profile">
                                                    {post.author.username}
                                                </Link>
                                            ) : (
                                                <Link
                                                    href={`/u/${encodeURIComponent(post.author.username)}`}
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
                                    <span className="text-xs text-gray-400">· {new Date(post.createdAt).toLocaleString()}</span>

                                    {/* Like */}
                                    <button
                                        className={clsx(
                                            "flex items-center ml-3 gap-1 text-xs transition",
                                            post.didLike ? "text-red-500 font-bold" : "text-gray-400 hover:text-red-400"
                                        )}
                                        onClick={() => handleLike(post.id)}
                                        disabled={!session}
                                        title={session ? (post.didLike ? "Unlike" : "Like") : "Sign in to like"}
                                    >
                                        <Heart size={18} fill={post.didLike ? "currentColor" : "none"} strokeWidth={2} />
                                        {post.likeCount}
                                    </button>

                                    {/* Comments toggle */}
                                    <button
                                        className={clsx(
                                            "flex items-center gap-1 text-xs ml-2 transition",
                                            openComments[post.id] ? "text-green-600 font-semibold" : "text-gray-400 hover:text-green-600"
                                        )}
                                        onClick={() => toggleComments(post.id)}
                                        title="Show comments"
                                    >
                                        <MessageCircle size={16} />
                                        {post.commentCount}
                                    </button>

                                    {/* Share */}
                                    <button
                                        className={clsx(
                                            "flex items-center gap-1 text-xs ml-2 transition",
                                            canShare ? "text-gray-500 hover:text-green-700" : "text-gray-300 cursor-not-allowed"
                                        )}
                                        onClick={() => canShare && openShareModal(post.id)}
                                        disabled={!canShare}
                                        title={canShare ? "Share via Messenger" : "Sign in to share"}
                                    >
                                        <Share2 size={16} />
                                        Share
                                    </button>
                                </div>
                            </div>

                            {/* Text content */}
                            {post.content && <div className="text-gray-700 mt-2 whitespace-pre-wrap">{post.content}</div>}

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
                                <div className="bg-white rounded-xl mt-4 p-4">
                                    <form onSubmit={e => { e.preventDefault(); handleAddComment(post.id); }} className="flex gap-2 mb-3">
                                        <input
                                            className="flex-1 border rounded px-2 py-1 text-sm"
                                            placeholder="Write a comment..."
                                            value={newComment[post.id] || ""}
                                            onChange={e => setNewComment(c => ({ ...c, [post.id]: e.target.value }))}
                                            disabled={!session}
                                        />
                                        <button className="bg-green-600 text-white px-3 py-1 rounded text-sm" type="submit" disabled={!session}>
                                            Comment
                                        </button>
                                    </form>
                                    {renderComments(post.comments, post.id)}
                                </div>
                            )}
                        </div>
                    ))}

                    {posts.length === 0 && (
                        <div className="text-gray-400 text-center py-12">No posts yet!</div>
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
                        className="bg-white rounded-xl shadow-xl w-[680px] max-w-[94vw] p-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-lg font-semibold">Share post</div>
                            <button
                                className="text-gray-500 hover:text-black"
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
                                    <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        className="w-full pl-8 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                                        placeholder="Search followers to start a new chat…"
                                        value={shareQuery}
                                        onChange={(e) => setShareQuery(e.target.value)}
                                    />
                                </div>
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
                                                    {(u.username || u.name || 'U').slice(0, 2)}
                                                </div>
                                                <div className="truncate">{displayName(u)}</div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-gray-100 my-3" />

                        {/* Existing conversations */}
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
