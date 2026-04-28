'use client';

import { X, Image as ImageIcon, Trash2, LayoutList, BarChart3, Plus } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { genUploader } from "uploadthing/client";

import type { UploadRouter } from "@/app/api/uploadthing/core";

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
            const uploadedFiles = mode === "standard" && images.length
                ? await uploadFiles("postMedia", {
                    files: images.map((image) => image.file),
                })
                : [];

            const imageUrls = uploadedFiles
                .map((file) => file.serverData?.url || file.ufsUrl || file.url)
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-xl shadow-lg w-96 relative dark:bg-neutral-900 dark:border dark:border-white/10 dark:text-gray-100">
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
                            <input
                                className={`border rounded-lg px-3 py-2 dark:bg-transparent dark:text-gray-100 ${
                                    fieldErrors.title
                                        ? "border-red-500 dark:border-red-400"
                                        : "dark:border-white/20"
                                }`}
                                type="text"
                                placeholder="Title"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                disabled={loading}
                            />

                            <textarea
                                className={`border rounded-lg px-3 py-2 resize-none min-h-[80px] dark:bg-transparent dark:text-gray-100 ${
                                    fieldErrors.content
                                        ? "border-red-500 dark:border-red-400"
                                        : "dark:border-white/20"
                                }`}
                                placeholder="What's on your mind?"
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                disabled={loading}
                            />

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
                        </>
                    ) : (
                        <>
                            <div className="space-y-3">
                                <div>
                                    <label className="mb-2 block text-sm font-medium">Poll question</label>
                                    <input
                                        className={`w-full rounded-lg border px-3 py-2 dark:bg-transparent dark:text-gray-100 ${
                                            fieldErrors.pollQuestion
                                                ? "border-red-500 dark:border-red-400"
                                                : "dark:border-white/20"
                                        }`}
                                        type="text"
                                        placeholder="What do you want feedback on?"
                                        value={pollQuestion}
                                        onChange={(event) => setPollQuestion(event.target.value)}
                                        disabled={loading}
                                    />
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
