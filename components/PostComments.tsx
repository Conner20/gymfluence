'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CornerDownRight, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatRelativeTime } from "@/lib/utils";
import { useLiveRefresh } from "@/app/hooks/useLiveRefresh";

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

function CommentNode({
    comment,
    depth = 0,
    sessionEmail,
    activeReplyId,
    replyDraft,
    onToggleReply,
    onReplyDraftChange,
    onSubmitReply,
    onDelete,
}: {
    comment: Comment;
    depth?: number;
    sessionEmail?: string | null;
    activeReplyId: string | null;
    replyDraft: string;
    onToggleReply: (commentId: string) => void;
    onReplyDraftChange: (commentId: string, value: string) => void;
    onSubmitReply: (commentId: string, value: string) => void | Promise<void>;
    onDelete: (commentId: string) => void | Promise<void>;
}) {
    const isMine = !!sessionEmail && comment.author?.email === sessionEmail;
    const showReply = activeReplyId === comment.id;

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
                                className="ml-2 flex items-center gap-1 text-[11px] text-red-500 hover:text-red-600 dark:hover:text-red-400 sm:text-[11px]"
                                onClick={() => onDelete(comment.id)}
                                title="Delete comment"
                            >
                                <Trash2 size={12} className="sm:h-3 sm:w-3" />
                                <span className="hidden sm:inline">Delete</span>
                            </button>
                        )}
                    </div>

                    <div className="mt-1 mb-1 text-sm whitespace-pre-wrap break-normal text-gray-800 dark:text-gray-100">
                        {comment.content}
                    </div>

                    {sessionEmail && depth === 0 && (
                        <button
                            className="text-[11px] text-green-600 hover:underline dark:text-green-600"
                            onClick={() => onToggleReply(comment.id)}
                        >
                            Reply
                        </button>
                    )}

                    {showReply && depth === 0 && (
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                                className="w-full flex-1 rounded border px-2 py-1 text-xs dark:bg-transparent dark:border-white/20 dark:text-gray-100"
                                value={replyDraft}
                                onChange={(e) => onReplyDraftChange(comment.id, e.target.value)}
                                placeholder="Reply..."
                            />
                            <button
                                className="inline-flex items-center gap-1 rounded bg-green-600 px-3 py-1 text-xs text-white dark:bg-green-600 sm:self-stretch"
                                onClick={() => onSubmitReply(comment.id, replyDraft)}
                            >
                                <CornerDownRight size={14} />
                            </button>
                        </div>
                    )}

                    {depth === 0 && comment.replies && comment.replies.length > 0 && (
                        <div className="ml-4 mt-2 border-l border-gray-100 pl-3 dark:border-white/10">
                            {comment.replies.map((reply) => (
                                <CommentNode
                                    key={reply.id}
                                    comment={reply}
                                    depth={1}
                                    sessionEmail={sessionEmail}
                                    activeReplyId={activeReplyId}
                                    replyDraft={replyDraft}
                                    onToggleReply={onToggleReply}
                                    onReplyDraftChange={onReplyDraftChange}
                                    onSubmitReply={onSubmitReply}
                                    onDelete={onDelete}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

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
    const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
    const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
    const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);

    const fetchComments = async (silent = false) => {
        if (!silent) setLoading(true);
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

    const hasActiveDraft =
        !!content.trim() ||
        activeReplyId !== null ||
        Object.values(replyDrafts).some((value) => value.trim().length > 0);

    useLiveRefresh(() => fetchComments(true), { enabled: !hasActiveDraft, interval: 5000 });

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
                    <CommentNode
                        key={comment.id}
                        comment={comment}
                        depth={0}
                        sessionEmail={session?.user?.email}
                        activeReplyId={activeReplyId}
                        replyDraft={replyDrafts[comment.id] ?? ""}
                        onToggleReply={(commentId) =>
                            setActiveReplyId((current) => (current === commentId ? null : commentId))
                        }
                        onReplyDraftChange={(commentId, value) =>
                            setReplyDrafts((prev) => ({
                                ...prev,
                                [commentId]: value,
                            }))
                        }
                        onSubmitReply={async (commentId, value) => {
                            await handleAdd(value, commentId);
                            setReplyDrafts((prev) => {
                                const next = { ...prev };
                                delete next[commentId];
                                return next;
                            });
                            setActiveReplyId(null);
                        }}
                        onDelete={(commentId) => setPendingDeleteCommentId(commentId)}
                    />
                ))
            )}
            <ConfirmDialog
                open={pendingDeleteCommentId !== null}
                title="Delete comment"
                message="Are you sure you want to delete this?"
                destructive
                onCancel={() => setPendingDeleteCommentId(null)}
                onConfirm={() => {
                    if (!pendingDeleteCommentId) return;
                    const commentId = pendingDeleteCommentId;
                    setPendingDeleteCommentId(null);
                    void handleDelete(commentId);
                }}
            />
        </div>
    );
}
