'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

export function EditPostDialog({
    open,
    initialTitle,
    initialContent,
    loading = false,
    onCancel,
    onSave,
}: {
    open: boolean;
    initialTitle: string;
    initialContent: string;
    loading?: boolean;
    onCancel: () => void;
    onSave: (values: { title: string; content: string }) => void | Promise<void>;
}) {
    const [title, setTitle] = useState(initialTitle);
    const [content, setContent] = useState(initialContent);

    useEffect(() => {
        if (!open) return;
        setTitle(initialTitle);
        setContent(initialContent);
    }, [open, initialTitle, initialContent]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onCancel}>
            <div
                className="relative w-96 rounded-xl bg-white p-6 shadow-lg dark:border dark:border-white/10 dark:bg-neutral-900 dark:text-gray-100"
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    onClick={onCancel}
                    className="absolute right-4 top-4 rounded-full p-1 transition hover:bg-zinc-100 dark:hover:bg-white/5"
                    aria-label="Close"
                    type="button"
                >
                    <X size={24} />
                </button>

                <h2 className="mb-4 text-xl font-bold">Edit Post</h2>

                <div className="flex flex-col gap-4">
                    <input
                        className="rounded-lg border px-3 py-2 dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Title"
                        disabled={loading}
                    />
                    <textarea
                        className="scrollbar-slim min-h-[80px] resize-none rounded-lg border px-3 py-2 dark:border-white/20 dark:bg-transparent dark:text-gray-100"
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        placeholder="What's on your mind?"
                        disabled={loading}
                    />
                </div>

                <button
                    type="button"
                    className="mt-6 w-full rounded-lg bg-green-600 py-2 font-semibold text-white transition hover:bg-green-700 disabled:opacity-60 dark:bg-green-600 dark:hover:bg-green-500"
                    onClick={() => void onSave({ title, content })}
                    disabled={loading}
                >
                    {loading ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    );
}

export function EditCommentDialog({
    open,
    initialContent,
    loading = false,
    onCancel,
    onSave,
}: {
    open: boolean;
    initialContent: string;
    loading?: boolean;
    onCancel: () => void;
    onSave: (content: string) => void | Promise<void>;
}) {
    const [content, setContent] = useState(initialContent);

    useEffect(() => {
        if (!open) return;
        setContent(initialContent);
    }, [open, initialContent]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4" onClick={onCancel}>
            <div
                className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-neutral-900"
                onClick={(event) => event.stopPropagation()}
            >
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Edit comment</h3>
                <textarea
                    className="scrollbar-slim mt-4 min-h-[120px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:bg-transparent dark:text-white"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Edit comment"
                    disabled={loading}
                />
                <div className="mt-4 flex justify-end gap-2">
                    <button
                        type="button"
                        className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="rounded-full bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800 dark:bg-white/90 dark:text-black dark:hover:bg-white"
                        onClick={() => void onSave(content)}
                        disabled={loading}
                    >
                        {loading ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
