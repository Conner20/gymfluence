'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CornerDownRight, Trash2 } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

type Comment = {
    id: string;
    content: string;
    createdAt: string;
    author: {
        username: string | null;
        email: string | null;
        image?: string | null;
    } | null;
    replies?: Comment[];
};

export function PostComments({
    postId,
    onCountChange,
}: {
    postId: string;
    onCountChange?: (count: number) => void;
}) {
    const { data: session } = useSession();
    const [comments, setComments] = useState<Comment[]>([]);
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);

    const fetchComments = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/posts/${postId}/comments`, { cache: "no-store" });
            if (!res.ok) throw new Error();
            const data: Comment[] = await res.json();
            setComments(data);
            const total = data.reduce(
                (sum, c) => sum + 1 + (c.replies?.length ?? 0),
                0
            );
            onCountChange?.(total);
        } catch {
            // optional: add error UI
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchComments();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [postId]);

    const handleAdd = async (content: string, parentId?: string) => {
        if (!content.trim()) return;
        try {
            const res = await fetch(`/api/posts/${postId}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content, parentId }),
            });
            if (!res.ok) throw new Error();
            const payload = await res.json().catch(() => ({}));
            if (typeof payload.commentCount === "number") {
                onCountChange?.(payload.commentCount);
            }
            setContent("");
            await fetchComments();
        } catch {
            alert("Failed to add comment.");
        }
    };

    const handleDelete = async (commentId: string) => {
        try {
            const res = await fetch(`/api/comments/${commentId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error();
            const payload = await res.json().catch(() => ({}));
            if (typeof payload.commentCount === "number") {
                onCountChange?.(payload.commentCount);
            }
            await fetchComments();
        } catch {
            alert("Failed to delete comment.");
        }
    };

    function CommentNode({ comment }: { comment: Comment }) {
        const [showReply, setShowReply] = useState(false);
        const [replyContent, setReplyContent] = useState("");

        const isMine =
            !!session?.user?.email && comment.author?.email === session.user.email;

        const displayName =
            comment.author?.username ||
            comment.author?.email?.split("@")[0] ||
            "Unknown";
        const profileSlug = comment.author?.username ?? null;

        const initials = (displayName || "U")
            .trim()
            .slice(0, 2)
            .toUpperCase();

        return (
            <div className="ml-0 mb-3">
                <div className="flex items-start gap-2">
                    {/* Avatar */}
                    {comment.author?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={comment.author.image}
                            alt={displayName}
                            className="w-8 h-8 rounded-full object-cover border"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 border flex items-center justify-center text-[11px] font-semibold uppercase text-gray-700 dark:bg-white/10 dark:border-white/20 dark:text-gray-100">
                            {initials}
                        </div>
                    )}

                    {/* Main comment body */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            {profileSlug ? (
                                <Link
                                    href={`/u/${encodeURIComponent(profileSlug)}`}
                                    className="font-semibold text-sm text-gray-800 transition hover:underline decoration-2 underline-offset-2 dark:text-gray-100"
                                    title={`View ${displayName}'s profile`}
                                >
                                    {displayName}
                                </Link>
                            ) : (
                                <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
                                    {displayName}
                                </span>
                            )}
                            <span
                                className="text-xs text-gray-400 dark:text-gray-400"
                                title={new Date(comment.createdAt).toLocaleString()}
                            >
                                {formatRelativeTime(comment.createdAt)}
                            </span>

                            {isMine && (
                                <button
                                    className="ml-2 text-[11px] text-red-500 hover:text-red-600 flex items-center gap-1 dark:hover:text-red-400"
                                    onClick={() => handleDelete(comment.id)}
                                    title="Delete comment"
                                >
                                    <Trash2 size={12} />
                                    Delete
                                </button>
                            )}
                        </div>

                        <div className="mt-1 mb-1 text-sm text-gray-800 dark:text-gray-100">
                            {comment.content}
                        </div>

                        {session && (
                            <button
                                className="text-[11px] text-green-600 hover:underline dark:text-green-600"
                                onClick={() => setShowReply(!showReply)}
                            >
                                Reply
                            </button>
                        )}

                        {showReply && (
                            <div className="mt-2 flex gap-1">
                                <input
                                    className="border px-2 py-1 rounded text-xs flex-1 dark:bg-transparent dark:border-white/20 dark:text-gray-100"
                                    value={replyContent}
                                    onChange={(e) => setReplyContent(e.target.value)}
                                    placeholder="Reply..."
                                />
                                <button
                                    className="text-xs bg-green-600 text-white px-2 py-1 rounded flex items-center gap-1 dark:bg-green-600"
                                    onClick={async () => {
                                        await handleAdd(replyContent, comment.id);
                                        setReplyContent("");
                                        setShowReply(false);
                                    }}
                                >
                                    <CornerDownRight size={14} />
                                </button>
                            </div>
                        )}

                        {/* Replies */}
                        {comment.replies && comment.replies.length > 0 && (
                            <div className="ml-4 mt-2 border-l border-gray-100 pl-3 dark:border-white/10">
                                {comment.replies.map((reply) => (
                                    <CommentNode key={reply.id} comment={reply} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl p-3 mt-4 dark:bg-neutral-900 dark:border dark:border-white/10">
            <h4 className="font-bold mb-2 text-gray-700 dark:text-gray-100">Comments</h4>

            {session && (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleAdd(content);
                    }}
                    className="flex gap-2 mb-4"
                >
                    <input
                        className="flex-1 border px-2 py-1 rounded text-sm dark:bg-transparent dark:border-white/20 dark:text-gray-100"
                        placeholder="Add a comment..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        required
                    />
                    <button
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm dark:bg-green-600 dark:hover:bg-green-700"
                        type="submit"
                    >
                        Post
                    </button>
                </form>
            )}

            {loading ? (
                <div className="text-sm text-gray-400 dark:text-gray-400">Loading comments...</div>
            ) : comments.length === 0 ? (
                <div className="text-gray-400 text-sm dark:text-gray-400">No comments yet.</div>
            ) : (
                comments.map((comment) => (
                    <CommentNode key={comment.id} comment={comment} />
                ))
            )}
        </div>
    );
}
