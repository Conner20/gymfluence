'use client';

import { X, Image as ImageIcon, Trash2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";

type SelectedImage = {
    id: string;
    file: File;
    previewUrl: string;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_POST_IMAGES = 3;

export default function CreatePost({
    onClose,
}: {
    onClose: () => void;
}) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [images, setImages] = useState<SelectedImage[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ title: boolean; content: boolean }>({
        title: false,
        content: false,
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
        if (!fieldErrors.title && !fieldErrors.content) return;
        const timeout = window.setTimeout(() => {
            setFieldErrors({ title: false, content: false });
        }, 1200);

        return () => window.clearTimeout(timeout);
    }, [fieldErrors]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const nextFieldErrors = {
            title: !title.trim(),
            content: !content.trim(),
        };

        if (nextFieldErrors.title || nextFieldErrors.content) {
            setFieldErrors(nextFieldErrors);
            return;
        }

        setLoading(true);
        try {
            const form = new FormData();
            form.append("title", title);
            form.append("content", content);
            images.forEach((image) => form.append("images", image.file));

            const res = await fetch("/api/posts", {
                method: "POST",
                body: form, // <-- multipart/form-data; do NOT set Content-Type manually
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.message || "Failed to create post.");
            } else {
                // ✅ tell any listeners (like TraineeProfile) to refresh posts
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new Event("post-created"));
                }

                // reset
                setTitle('');
                setContent('');
                clearImages();
                onClose();
            }
        } catch {
            setError("Something went wrong.");
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

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

                    {/* Image picker + preview */}
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
                                        PNG, JPG, WEBP, GIF · up to 8MB each
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
                        {loading ? "Posting..." : "Post"}
                    </button>
                </form>
            </div>
        </div>
    );
}
