'use client';

import { X, Image as ImageIcon, Trash2, LayoutList, BarChart3, Plus } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { genUploader } from "uploadthing/client";

import type { UploadRouter } from "@/app/api/uploadthing/core";
import MentionSuggestions from "@/components/ui/mention-suggestions";
import { getActiveMentionQuery, replaceMentionAtCursor, type MentionSearchResult } from "@/lib/mentions";

type SelectedImage = {
    id: string;
    file: File;
    previewUrl: string;
};

const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const MAX_POST_IMAGES = 3;
const { uploadFiles } = genUploader<UploadRouter>();

export default function CreatePost({
    onClose,
}: {
    onClose: () => void;
}) {
    const [mode, setMode] = useState<"standard" | "poll">("standard");
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
    const [images, setImages] = useState<SelectedImage[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{
        title: boolean;
        content: boolean;
        pollQuestion: boolean;
        pollOptions: boolean[];
    }>({
        title: false,
        content: false,
        pollQuestion: false,
        pollOptions: [false, false],
    });

    const inputRef = useRef<HTMLInputElement | null>(null);
    const imagesRef = useRef<SelectedImage[]>([]);
    const titleRef = useRef<HTMLInputElement | null>(null);
    const contentRef = useRef<HTMLTextAreaElement | null>(null);
    const pollQuestionRef = useRef<HTMLInputElement | null>(null);
    const [mentionField, setMentionField] = useState<"title" | "content" | "pollQuestion" | null>(null);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionCursor, setMentionCursor] = useState(0);
    const [mentionResults, setMentionResults] = useState<MentionSearchResult[]>([]);
    const [mentionLoading, setMentionLoading] = useState(false);

    const onPickFile = () => inputRef.current?.click();

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (!files.length) {
            return;
        }

        const nextImages: SelectedImage[] = [];
        for (const file of files) {
            if (file.size > MAX_IMAGE_BYTES) {
                setError("Each image must be 8MB or smaller.");
                continue;
            }
            if (!file.type.startsWith("image/")) {
                setError("Only image files are allowed.");
                continue;
            }
            nextImages.push({
                id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
                file,
                previewUrl: URL.createObjectURL(file),
            });
        }

        if (!nextImages.length) {
            e.target.value = "";
            return;
        }

        setImages((current) => {
            const combined = [...current, ...nextImages];
            if (combined.length <= MAX_POST_IMAGES) {
                setError(null);
                return combined;
            }

            combined.slice(MAX_POST_IMAGES).forEach((image) => URL.revokeObjectURL(image.previewUrl));
            setError("You can upload up to 3 images per post.");
            return combined.slice(0, MAX_POST_IMAGES);
        });
        e.target.value = "";
    };

    const removeImage = (id: string) => {
        setImages((current) => {
            const target = current.find((image) => image.id === id);
            if (target) URL.revokeObjectURL(target.previewUrl);
            return current.filter((image) => image.id !== id);
        });
        if (inputRef.current) inputRef.current.value = "";
    };

    const clearImages = () => {
        images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
        setImages([]);
        if (inputRef.current) inputRef.current.value = "";
    };

    useEffect(() => {
        imagesRef.current = images;
    }, [images]);

    useEffect(() => {
        return () => {
            imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
        };
    }, []);

    useEffect(() => {
        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;

        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
        };
    }, []);

    useEffect(() => {
        if (!mentionField) {
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
    }, [mentionField, mentionQuery]);

    const updateMentionState = (field: "title" | "content" | "pollQuestion", value: string, cursor: number) => {
        const activeMention = getActiveMentionQuery(value, cursor);
        if (!activeMention) {
            if (mentionField === field) {
                setMentionField(null);
                setMentionQuery("");
                setMentionResults([]);
            }
            return;
        }

        setMentionField(field);
        setMentionQuery(activeMention.query);
        setMentionCursor(cursor);
    };

    const insertMention = (item: MentionSearchResult) => {
        const ref =
            mentionField === "title"
                ? titleRef.current
                : mentionField === "content"
                  ? contentRef.current
                  : pollQuestionRef.current;
        if (!mentionField || !ref) return;

        const currentValue =
            mentionField === "title"
                ? title
                : mentionField === "content"
                  ? content
                  : pollQuestion;

        const { nextValue, nextCursor } = replaceMentionAtCursor(currentValue, mentionCursor, item.username);
        if (mentionField === "title") setTitle(nextValue);
        if (mentionField === "content") setContent(nextValue);
        if (mentionField === "pollQuestion") setPollQuestion(nextValue);

        setMentionField(null);
        setMentionQuery("");
        setMentionResults([]);

        window.requestAnimationFrame(() => {
            ref.focus();
            ref.setSelectionRange(nextCursor, nextCursor);
        });
    };

    useEffect(() => {
        if (
            !fieldErrors.title &&
            !fieldErrors.content &&
            !fieldErrors.pollQuestion &&
            !fieldErrors.pollOptions.some(Boolean)
        ) {
            return;
        }
        const timeout = window.setTimeout(() => {
            setFieldErrors({
                title: false,
                content: false,
                pollQuestion: false,
                pollOptions: new Array(Math.max(pollOptions.length, 2)).fill(false),
            });
        }, 1200);

        return () => window.clearTimeout(timeout);
    }, [fieldErrors, pollOptions.length]);

    const updatePollOption = (index: number, value: string) => {
        setPollOptions((current) => current.map((option, optionIndex) => (optionIndex === index ? value : option)));
    };

    const addPollOption = () => {
        setPollOptions((current) => (current.length >= 5 ? current : [...current, '']));
    };

    const removePollOption = (index: number) => {
        setPollOptions((current) => {
            if (current.length <= 2) return current;
            return current.filter((_, optionIndex) => optionIndex !== index);
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const trimmedPollOptions = pollOptions.map((option) => option.trim());
        if (mode === "standard") {
            const nextFieldErrors = {
                title: !title.trim(),
                content: !content.trim(),
                pollQuestion: false,
                pollOptions: new Array(Math.max(pollOptions.length, 2)).fill(false),
            };

            if (nextFieldErrors.title || nextFieldErrors.content) {
                setFieldErrors(nextFieldErrors);
                return;
            }
        } else {
            const optionErrors = pollOptions.map((option) => !option.trim());
            const validOptions = trimmedPollOptions.filter(Boolean);
            const nextFieldErrors = {
                title: false,
                content: false,
                pollQuestion: !pollQuestion.trim(),
                pollOptions: optionErrors,
            };

            if (nextFieldErrors.pollQuestion || validOptions.length < 2) {
                setFieldErrors(nextFieldErrors);
                if (validOptions.length < 2) {
                    setError("Polls need at least two answer options.");
                }
                return;
            }
        }

        setLoading(true);
        try {
            const uploadedFiles = images.length
                ? await uploadFiles("postMedia", {
                    files: images.map((image) => image.file),
                })
                : [];

            const imageUrls = uploadedFiles
                .map((file) => file.serverData?.url || file.ufsUrl)
                .filter(Boolean);

            const res = await fetch("/api/posts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title,
                    content,
                    type: mode === "poll" ? "POLL" : "STANDARD",
                    pollQuestion,
                    pollOptions: trimmedPollOptions.filter(Boolean),
                    imageUrls,
                }),
            });

            if (!res.ok) {
                const responseText = await res.text().catch(() => "");
                let message = "Failed to create post.";

                try {
                    const data = responseText ? JSON.parse(responseText) : {};
                    message = data?.message || message;
                } catch {
                    if (res.status === 413) {
                        message = "Your selected files are too large to upload. Try smaller files.";
                    } else if (res.status >= 500) {
                        message = "Unable to create post right now. Please try again.";
                    }
                }

                setError(message);
            } else {
                // ✅ tell any listeners (like TraineeProfile) to refresh posts
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new Event("post-created"));
                }

                // reset
                setTitle('');
                setContent('');
                setPollQuestion('');
                setPollOptions(['', '']);
                setMode('standard');
                clearImages();
                onClose();
            }
        } catch (err: any) {
            const rawMessage =
                typeof err?.message === "string"
                    ? err.message
                    : typeof err?.cause?.message === "string"
                        ? err.cause.message
                        : "";

            const lowerMessage = rawMessage.toLowerCase();
            if (lowerMessage.includes("file") && lowerMessage.includes("size")) {
                setError(rawMessage);
            } else if (lowerMessage.includes("unauthorized")) {
                setError("You need to be signed in to post.");
            } else if (rawMessage) {
                setError(rawMessage);
            } else {
                setError("Unable to upload files right now. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg dark:border dark:border-white/10 dark:bg-neutral-900 dark:text-gray-100">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 p-1 hover:bg-zinc-100 rounded-full transition dark:hover:bg-white/5"
                    aria-label="Close"
                    type="button"
                >
                    <X size={24} />
                </button>

                <h2 className="text-xl font-bold mb-4">Create Post</h2>

                <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border p-1 dark:border-white/10">
                    <button
                        type="button"
                        onClick={() => setMode("standard")}
                        className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                            mode === "standard"
                                ? "bg-black text-white dark:bg-white dark:text-black"
                                : "text-zinc-600 hover:bg-zinc-100 dark:text-gray-300 dark:hover:bg-white/5"
                        }`}
                    >
                        <LayoutList size={16} />
                        <span>Post</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode("poll")}
                        className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                            mode === "poll"
                                ? "bg-black text-white dark:bg-white dark:text-black"
                                : "text-zinc-600 hover:bg-zinc-100 dark:text-gray-300 dark:hover:bg-white/5"
                        }`}
                    >
                        <BarChart3 size={16} />
                        <span>Poll</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {mode === "standard" ? (
                        <>
                            <div className="relative">
                                <input
                                    ref={titleRef}
                                    className={`w-full border rounded-lg px-3 py-2 dark:bg-transparent dark:text-gray-100 ${
                                        fieldErrors.title
                                            ? "border-red-500 dark:border-red-400"
                                            : "dark:border-white/20"
                                    }`}
                                    type="text"
                                    placeholder="Title"
                                    value={title}
                                    onChange={e => {
                                        setTitle(e.target.value);
                                        updateMentionState("title", e.target.value, e.target.selectionStart ?? e.target.value.length);
                                    }}
                                    onClick={e => updateMentionState("title", e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                                    onKeyUp={e => updateMentionState("title", e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                                    onBlur={() => window.setTimeout(() => setMentionField((current) => (current === "title" ? null : current)), 100)}
                                    disabled={loading}
                                />
                                <MentionSuggestions open={mentionField === "title"} loading={mentionLoading} items={mentionResults} onSelect={insertMention} />
                            </div>

                            <div className="relative">
                                <textarea
                                    ref={contentRef}
                                    className={`w-full border rounded-lg px-3 py-2 resize-none min-h-[80px] dark:bg-transparent dark:text-gray-100 ${
                                        fieldErrors.content
                                            ? "border-red-500 dark:border-red-400"
                                            : "dark:border-white/20"
                                    }`}
                                    placeholder="What's on your mind?"
                                    value={content}
                                    onChange={e => {
                                        setContent(e.target.value);
                                        updateMentionState("content", e.target.value, e.target.selectionStart ?? e.target.value.length);
                                    }}
                                    onClick={e => updateMentionState("content", e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                                    onKeyUp={e => updateMentionState("content", e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                                    onBlur={() => window.setTimeout(() => setMentionField((current) => (current === "content" ? null : current)), 100)}
                                    disabled={loading}
                                />
                                <MentionSuggestions open={mentionField === "content"} loading={mentionLoading} items={mentionResults} onSelect={insertMention} />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-3">
                                <div>
                                    <label className="mb-2 block text-sm font-medium">Poll question</label>
                                    <div className="relative">
                                        <input
                                            ref={pollQuestionRef}
                                            className={`w-full rounded-lg border px-3 py-2 dark:bg-transparent dark:text-gray-100 ${
                                                fieldErrors.pollQuestion
                                                    ? "border-red-500 dark:border-red-400"
                                                    : "dark:border-white/20"
                                            }`}
                                            type="text"
                                            placeholder="What do you want feedback on?"
                                            value={pollQuestion}
                                            onChange={(event) => {
                                                setPollQuestion(event.target.value);
                                                updateMentionState("pollQuestion", event.target.value, event.target.selectionStart ?? event.target.value.length);
                                            }}
                                            onClick={(event) => updateMentionState("pollQuestion", event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length)}
                                            onKeyUp={(event) => updateMentionState("pollQuestion", event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length)}
                                            onBlur={() => window.setTimeout(() => setMentionField((current) => (current === "pollQuestion" ? null : current)), 100)}
                                            disabled={loading}
                                        />
                                        <MentionSuggestions open={mentionField === "pollQuestion"} loading={mentionLoading} items={mentionResults} onSelect={insertMention} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium">Answer options</label>
                                        {pollOptions.length < 5 && (
                                            <button
                                                type="button"
                                                onClick={addPollOption}
                                                className="inline-flex items-center gap-1 text-xs text-zinc-600 transition hover:text-zinc-900 dark:text-gray-300 dark:hover:text-white"
                                                disabled={loading}
                                            >
                                                <Plus size={14} />
                                                Add option
                                            </button>
                                        )}
                                    </div>
                                    {pollOptions.map((option, index) => (
                                        <div key={`poll-option-${index}`} className="flex items-center gap-2">
                                            <input
                                                className={`w-full rounded-lg border px-3 py-2 dark:bg-transparent dark:text-gray-100 ${
                                                    fieldErrors.pollOptions[index]
                                                        ? "border-red-500 dark:border-red-400"
                                                        : "dark:border-white/20"
                                                }`}
                                                type="text"
                                                placeholder={`Option ${index + 1}`}
                                                value={option}
                                                onChange={(event) => updatePollOption(index, event.target.value)}
                                                disabled={loading}
                                            />
                                            {pollOptions.length > 2 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removePollOption(index)}
                                                    className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-red-500 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-red-400"
                                                    title="Remove option"
                                                    disabled={loading}
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <div className="text-[11px] text-zinc-500 dark:text-gray-400">
                                        Add between 2 and 5 options.
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Attach up to 3 photos (optional)</label>
                            {images.length > 0 && (
                                <button
                                    type="button"
                                    onClick={clearImages}
                                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                                    title="Remove all images"
                                    disabled={loading}
                                >
                                    <Trash2 size={14} />
                                    Clear all
                                </button>
                            )}
                        </div>

                        <div className="mt-2">
                            {images.length === 0 ? (
                                <button
                                    type="button"
                                    onClick={onPickFile}
                                    className="w-full border border-dashed rounded-lg py-6 flex flex-col items-center justify-center hover:bg-zinc-50 transition dark:border-white/20 dark:hover:bg-white/5"
                                    disabled={loading}
                                >
                                    <ImageIcon size={22} className="mb-1" />
                                    <span className="text-sm text-zinc-600 dark:text-gray-200">Click to choose up to 3 images</span>
                                    <span className="text-[11px] text-zinc-400 mt-1 dark:text-gray-400">
                                        PNG, JPG, WEBP, GIF · up to 16MB each
                                    </span>
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        {images.map((image) => (
                                            <div key={image.id} className="relative rounded-lg border p-1 dark:border-white/20">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={image.previewUrl}
                                                    alt="Preview"
                                                    className="h-36 w-full rounded-md object-cover"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(image.id)}
                                                    className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white"
                                                    aria-label="Remove image"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    {images.length < MAX_POST_IMAGES && (
                                        <button
                                            type="button"
                                            onClick={onPickFile}
                                            className="w-full rounded-lg border border-dashed px-3 py-3 text-sm text-zinc-600 transition hover:bg-zinc-50 dark:border-white/20 dark:text-gray-200 dark:hover:bg-white/5"
                                            disabled={loading}
                                        >
                                            Add another image ({images.length}/{MAX_POST_IMAGES})
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            multiple
                            onChange={onFileChange}
                            disabled={loading}
                        />
                    </div>

                    {error && <div className="text-red-500 text-sm">{error}</div>}

                    <button
                        className="bg-green-600 text-white rounded-lg py-2 font-semibold mt-2 hover:bg-green-700 transition disabled:opacity-60 dark:bg-green-600 dark:hover:bg-green-500"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? "Posting..." : mode === "poll" ? "Post Poll" : "Post"}
                    </button>
                </form>
            </div>
        </div>
    );
}
