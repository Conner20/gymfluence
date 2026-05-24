'use client';

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CornerDownRight, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditCommentDialog } from "@/components/ui/edit-content-dialog";
import MentionSuggestions from "@/components/ui/mention-suggestions";
import MentionText from "@/components/ui/mention-text";
import { formatRelativeTime } from "@/lib/utils";
import { useLiveRefresh } from "@/app/hooks/useLiveRefresh";
import { getActiveMentionQuery, replaceMentionAtCursor, type MentionSearchResult } from "@/lib/mentions";

type Comment = {
    id: string;
    content: string;
    createdAt: string;
    author: {
        username: string | null;
        email: string | null;
        name?: string | null;
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
    onEdit,
    onDelete,
    mentionTarget,
    mentionLoading,
    mentionResults,
    onReplyMentionStateChange,
    onMentionSelect,
    onMentionBlur,
    replyInputRefs,
}: {
    comment: Comment;
    depth?: number;
    sessionEmail?: string | null;
    activeReplyId: string | null;
    replyDraft: string;
    onToggleReply: (commentId: string) => void;
    onReplyDraftChange: (commentId: string, value: string) => void;
    onSubmitReply: (commentId: string, value: string) => void | Promise<void>;
    onEdit: (comment: Comment) => void;
    onDelete: (commentId: string) => void | Promise<void>;
    mentionTarget: string | null;
    mentionLoading: boolean;
    mentionResults: MentionSearchResult[];
    onReplyMentionStateChange: (commentId: string, value: string, cursor: number) => void;
    onMentionSelect: (item: MentionSearchResult) => void;
    onMentionBlur: (target: string) => void;
    replyInputRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
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
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
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
                                className="whitespace-nowrap text-xs text-gray-400 dark:text-gray-400"
                                title={new Date(comment.createdAt).toLocaleString()}
                            >
                                {formatRelativeTime(comment.createdAt)}
                            </span>
                        </div>

                        {isMine && (
                            <div className="flex shrink-0 items-center gap-2 pt-0.5">
                                <button
                                    className="text-zinc-400 transition hover:text-zinc-700 dark:text-gray-500 dark:hover:text-gray-200"
                                    onClick={() => onEdit(comment)}
                                    title="Edit comment"
                                >
                                    <Pencil size={12} className="sm:h-3 sm:w-3" />
                                </button>
                                <button
                                    className="text-red-500 hover:text-red-600 dark:hover:text-red-400"
                                    onClick={() => onDelete(comment.id)}
                                    title="Delete comment"
                                >
                                    <Trash2 size={12} className="sm:h-3 sm:w-3" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="mt-1 mb-1 text-sm whitespace-pre-wrap break-normal text-gray-800 dark:text-gray-100">
                        <MentionText text={comment.content} />
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
                            <div className="relative w-full flex-1">
                                <input
                                    ref={(node) => {
                                        replyInputRefs.current[comment.id] = node;
                                    }}
                                    className="w-full flex-1 rounded border px-2 py-1 text-xs dark:bg-transparent dark:border-white/20 dark:text-gray-100"
                                    value={replyDraft}
                                    onChange={(e) => {
                                        onReplyDraftChange(comment.id, e.target.value);
                                        onReplyMentionStateChange(comment.id, e.target.value, e.target.selectionStart ?? e.target.value.length);
                                    }}
                                    onClick={(e) => onReplyMentionStateChange(comment.id, e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                                    onKeyUp={(e) => onReplyMentionStateChange(comment.id, e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                                    onBlur={() => onMentionBlur(`reply:${comment.id}`)}
                                    placeholder="Reply..."
                                />
                                <MentionSuggestions
                                    open={mentionTarget === `reply:${comment.id}`}
                                    loading={mentionLoading}
                                    items={mentionResults}
                                    onSelect={onMentionSelect}
                                />
                            </div>
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
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    mentionTarget={mentionTarget}
                                    mentionLoading={mentionLoading}
                                    mentionResults={mentionResults}
                                    onReplyMentionStateChange={onReplyMentionStateChange}
                                    onMentionSelect={onMentionSelect}
                                    onMentionBlur={onMentionBlur}
                                    replyInputRefs={replyInputRefs}
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
    const [editingComment, setEditingComment] = useState<Comment | null>(null);
    const [editingCommentLoading, setEditingCommentLoading] = useState(false);
    const [mentionTarget, setMentionTarget] = useState<string | null>(null);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionCursor, setMentionCursor] = useState(0);
    const [mentionResults, setMentionResults] = useState<MentionSearchResult[]>([]);
    const [mentionLoading, setMentionLoading] = useState(false);
    const commentInputRef = useRef<HTMLInputElement | null>(null);
    const replyInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

    useEffect(() => {
        if (!mentionTarget) {
            setMentionResults([]);
            setMentionLoading(false);
            return;
        }

        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            try {
                setMentionLoading(true);
                const res = await fetch(`/api/user/mention-search?q=${encodeURIComponent(mentionQuery)}`, {
                    cache: "no-store",
                    signal: controller.signal,
                });
                if (!res.ok) throw new Error();
                const data = await res.json();
                setMentionResults(Array.isArray(data?.items) ? data.items : []);
            } catch {
                if (!controller.signal.aborted) setMentionResults([]);
            } finally {
                if (!controller.signal.aborted) setMentionLoading(false);
            }
        }, 120);

        return () => {
            controller.abort();
            window.clearTimeout(timeout);
        };
    }, [mentionTarget, mentionQuery]);

    const updateMentionState = (target: string, value: string, cursor: number) => {
        const activeMention = getActiveMentionQuery(value, cursor);
        if (!activeMention) {
            if (mentionTarget === target) {
                setMentionTarget(null);
                setMentionQuery("");
                setMentionResults([]);
            }
            return;
        }

        setMentionTarget(target);
        setMentionQuery(activeMention.query);
        setMentionCursor(cursor);
    };

    const handleMentionBlur = (target: string) => {
        window.setTimeout(() => {
            setMentionTarget((current) => (current === target ? null : current));
        }, 100);
    };

    const insertMention = (item: MentionSearchResult) => {
        if (!mentionTarget) return;

        if (mentionTarget === "main") {
            const { nextValue, nextCursor } = replaceMentionAtCursor(content, mentionCursor, item.username);
            setContent(nextValue);
            setMentionTarget(null);
            setMentionQuery("");
            setMentionResults([]);
            window.requestAnimationFrame(() => {
                commentInputRef.current?.focus();
                commentInputRef.current?.setSelectionRange(nextCursor, nextCursor);
            });
            return;
        }

        if (mentionTarget.startsWith("reply:")) {
            const commentId = mentionTarget.slice(6);
            const currentValue = replyDrafts[commentId] ?? "";
            const { nextValue, nextCursor } = replaceMentionAtCursor(currentValue, mentionCursor, item.username);
            setReplyDrafts((prev) => ({ ...prev, [commentId]: nextValue }));
            setMentionTarget(null);
            setMentionQuery("");
            setMentionResults([]);
            window.requestAnimationFrame(() => {
                const input = replyInputRefs.current[commentId];
                input?.focus();
                input?.setSelectionRange(nextCursor, nextCursor);
            });
        }
    };

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

    const handleEdit = async (content: string) => {
        if (!editingComment) return;
        const nextContent = content.trim();
        if (!nextContent) return;

        try {
            setEditingCommentLoading(true);
            const res = await fetch(`/api/comments/${editingComment.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: nextContent }),
            });
            if (!res.ok) throw new Error();
            await fetchComments(true);
            setEditingComment(null);
        } catch {
            alert("Failed to update comment.");
        } finally {
            setEditingCommentLoading(false);
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
                    <div className="relative flex-1">
                        <input
                            ref={commentInputRef}
                            className="w-full border px-2 py-1 rounded text-sm dark:bg-transparent dark:border-white/20 dark:text-gray-100"
                            placeholder="Add a comment..."
                            value={content}
                            onChange={(e) => {
                                setContent(e.target.value);
                                updateMentionState("main", e.target.value, e.target.selectionStart ?? e.target.value.length);
                            }}
                            onClick={(e) => updateMentionState("main", e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                            onKeyUp={(e) => updateMentionState("main", e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                            onBlur={() => handleMentionBlur("main")}
                            required
                        />
                        <MentionSuggestions
                            open={mentionTarget === "main"}
                            loading={mentionLoading}
                            items={mentionResults}
                            onSelect={insertMention}
                        />
                    </div>
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
                        onEdit={(comment) => setEditingComment(comment)}
                        onDelete={(commentId) => setPendingDeleteCommentId(commentId)}
                        mentionTarget={mentionTarget}
                        mentionLoading={mentionLoading}
                        mentionResults={mentionResults}
                        onReplyMentionStateChange={(commentId, value, cursor) =>
                            updateMentionState(`reply:${commentId}`, value, cursor)
                        }
                        onMentionSelect={insertMention}
                        onMentionBlur={handleMentionBlur}
                        replyInputRefs={replyInputRefs}
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
            <EditCommentDialog
                open={editingComment !== null}
                initialContent={editingComment?.content ?? ""}
                loading={editingCommentLoading}
                onCancel={() => {
                    if (editingCommentLoading) return;
                    setEditingComment(null);
                }}
                onSave={(value) => void handleEdit(value)}
            />
        </div>
    );
}
