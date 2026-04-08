'use client';

import { X, Image as ImageIcon, Trash2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";

type SelectedImage = {
    id: string;
    file: File;
    previewUrl: string;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_UPLOAD_BYTES = 18 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const TARGET_IMAGE_BYTES = 2.5 * 1024 * 1024;

const loadImageElement = (file: File) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Failed to read image."));
        };

        image.src = objectUrl;
    });

const canvasToFile = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
    new Promise<File>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error("Failed to process image."));
                return;
            }

            const extension =
                type === "image/webp"
                    ? "webp"
                    : type === "image/png"
                        ? "png"
                        : "jpg";

            resolve(
                new File([blob], `post-image.${extension}`, {
                    type,
                    lastModified: Date.now(),
                })
            );
        }, type, quality);
    });

async function optimizeImageForPost(file: File) {
    if (!file.type.startsWith("image/")) {
        throw new Error("Only image files are allowed.");
    }

    if (file.type === "image/gif") {
        return file;
    }

    const image = await loadImageElement(file);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext("2d");
    if (!context) {
        return file;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const outputType = file.type === "image/png" ? "image/png" : "image/webp";
    const qualities = outputType === "image/png" ? [undefined] : [0.82, 0.72, 0.62, 0.5];
    let candidate = file;

    for (const quality of qualities) {
        const nextFile = await canvasToFile(canvas, outputType, quality);
        candidate = nextFile;
        if (candidate.size <= TARGET_IMAGE_BYTES) {
            break;
        }
    }

    return candidate.size < file.size ? candidate : file;
}

export default function CreatePost({
    onClose,
}: {
    onClose: () => void;
}) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [images, setImages] = useState<SelectedImage[]>([]);
    const [loading, setLoading] = useState(false);
    const [processingImages, setProcessingImages] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ title: boolean; content: boolean }>({
        title: false,
        content: false,
    });

    const inputRef = useRef<HTMLInputElement | null>(null);
    const imagesRef = useRef<SelectedImage[]>([]);

    const onPickFile = () => inputRef.current?.click();

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (!files.length) {
            return;
        }

        setProcessingImages(true);
        setError(null);
        const nextImages: SelectedImage[] = [];
        try {
            for (const file of files) {
                const optimized = await optimizeImageForPost(file);
                if (optimized.size > MAX_IMAGE_BYTES) {
                    setError("Each image must be 8MB or smaller.");
                    continue;
                }

                nextImages.push({
                    id: `${optimized.name}-${optimized.size}-${optimized.lastModified}-${Math.random().toString(36).slice(2)}`,
                    file: optimized,
                    previewUrl: URL.createObjectURL(optimized),
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to process image.");
        } finally {
            setProcessingImages(false);
        }

        if (!nextImages.length) {
            e.target.value = "";
            return;
        }

        setImages((current) => {
            const combined = [...current, ...nextImages];
            if (combined.length <= 5) {
                const totalBytes = combined.reduce((sum, image) => sum + image.file.size, 0);
                if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
                    nextImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
                    setError("Selected photos are too large together. Try fewer photos or smaller ones.");
                    return current;
                }

                setError(null);
                return combined;
            }

            combined.slice(5).forEach((image) => URL.revokeObjectURL(image.previewUrl));
            setError("You can upload up to 5 images per post.");
            return combined.slice(0, 5);
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

        const totalBytes = images.reduce((sum, image) => sum + image.file.size, 0);
        if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
            setError("Selected photos are too large together. Try fewer photos or smaller ones.");
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
                const responseText = await res.text().catch(() => "");
                let message = "Failed to create post.";
                try {
                    const data = responseText ? JSON.parse(responseText) : {};
                    message = data?.message || message;
                } catch {
                    if (res.status === 413) {
                        message = "Selected photos are too large together. Try fewer photos or smaller ones.";
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
                        disabled={loading || processingImages}
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
                        disabled={loading || processingImages}
                    />

                    {/* Image picker + preview */}
                    <div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Attach up to 5 photos (optional)</label>
                            {images.length > 0 && (
                                <button
                                    type="button"
                                    onClick={clearImages}
                                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                                    title="Remove all images"
                                    disabled={loading || processingImages}
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
                                    disabled={loading || processingImages}
                                >
                                    <ImageIcon size={22} className="mb-1" />
                                    <span className="text-sm text-zinc-600 dark:text-gray-200">Click to choose up to 5 images</span>
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
                                    {images.length < 5 && (
                                        <button
                                            type="button"
                                            onClick={onPickFile}
                                            className="w-full rounded-lg border border-dashed px-3 py-3 text-sm text-zinc-600 transition hover:bg-zinc-50 dark:border-white/20 dark:text-gray-200 dark:hover:bg-white/5"
                                            disabled={loading || processingImages}
                                        >
                                            Add another image ({images.length}/5)
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
                            disabled={loading || processingImages}
                        />
                    </div>

                    {error && <div className="text-red-500 text-sm">{error}</div>}
                    {processingImages && <div className="text-sm text-zinc-500 dark:text-gray-400">Optimizing photos...</div>}

                    <button
                        className="bg-green-600 text-white rounded-lg py-2 font-semibold mt-2 hover:bg-green-700 transition disabled:opacity-60 dark:bg-green-600 dark:hover:bg-green-500"
                        type="submit"
                        disabled={loading || processingImages}
                    >
                        {loading ? "Posting..." : "Post"}
                    </button>
                </form>
            </div>
        </div>
    );
}
