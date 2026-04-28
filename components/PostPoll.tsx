'use client';

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import clsx from "clsx";

import type { PostPollData } from "@/lib/postPoll";

export default function PostPoll({
    postId,
    poll,
    isOwner = false,
    onPollChange,
}: {
    postId: string;
    poll: PostPollData;
    isOwner?: boolean;
    onPollChange?: (poll: PostPollData) => void;
}) {
    const { data: session } = useSession();
    const [currentPoll, setCurrentPoll] = useState(poll);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setCurrentPoll(poll);
    }, [poll, postId]);

    const showResults = isOwner || currentPoll.viewerHasVoted;

    const handleVote = async (optionId: string) => {
        if (isOwner || submitting || currentPoll.viewerHasVoted) return;
        if (!session) {
            setError("Sign in to vote.");
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/vote`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ optionId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.poll) {
                throw new Error(data?.message || "Failed to submit vote.");
            }
            setCurrentPoll(data.poll);
            onPollChange?.(data.poll);
        } catch (voteError) {
            setError(voteError instanceof Error ? voteError.message : "Failed to submit vote.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="mt-3">
            <div className="space-y-2.5">
                {currentPoll.options.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => void handleVote(option.id)}
                        disabled={isOwner || submitting || currentPoll.viewerHasVoted}
                        className={clsx(
                            "w-full rounded-xl border px-3 py-3 text-left transition",
                            showResults
                                ? option.isSelected
                                    ? "cursor-default border-zinc-300 bg-zinc-50 dark:border-white/15 dark:bg-black/20"
                                    : "cursor-default border-zinc-300 bg-zinc-50 dark:border-white/15 dark:bg-black/20"
                                : "border-zinc-300 bg-zinc-50 hover:border-zinc-500 hover:bg-zinc-100 dark:border-white/15 dark:bg-black/20 dark:hover:border-white/30 dark:hover:bg-white/10",
                            option.isSelected && !showResults && "border-green-600 bg-green-50 dark:border-green-400 dark:bg-green-500/10"
                        )}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-zinc-900 dark:text-white">{option.text}</span>
                            {showResults && (
                                <span className="shrink-0 text-xs text-zinc-500 dark:text-gray-400">
                                    {option.voteCount} · {option.percentage}%
                                </span>
                            )}
                        </div>
                        {showResults && (
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                                <div
                                    className={clsx(
                                        "h-full rounded-full transition-[width]",
                                        isOwner || option.isSelected ? "bg-green-700 dark:bg-green-400" : "bg-zinc-400 dark:bg-white/40"
                                    )}
                                    style={{ width: `${option.percentage}%` }}
                                />
                            </div>
                        )}
                    </button>
                ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-500 dark:text-gray-400">
                <span>
                    {showResults
                        ? `${currentPoll.totalVotes} total vote${currentPoll.totalVotes === 1 ? "" : "s"}`
                        : isOwner
                            ? `${currentPoll.totalVotes} total vote${currentPoll.totalVotes === 1 ? "" : "s"}`
                            : "Select an option to vote."}
                </span>
                {submitting && <span>Submitting…</span>}
            </div>
            {error && <div className="mt-2 text-xs text-red-500 dark:text-red-400">{error}</div>}
        </div>
    );
}
