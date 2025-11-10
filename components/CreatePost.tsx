'use client';

import { X, Image as ImageIcon, Trash2 } from "lucide-react";
import { useState, useRef } from "react";

export default function CreatePost({
    onClose,
}: {
    onClose: () => void;
}) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const inputRef = useRef<HTMLInputElement | null>(null);

    const onPickFile = () => inputRef.current?.click();

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] || null;
        if (!f) {
            setFile(null);
            setPreviewUrl(null);
            return;
        }

        // Basic guardrails
        const maxBytes = 8 * 1024 * 1024; // 8MB
        if (f.size > maxBytes) {
            setError("Image too large (max 8MB).");
            e.target.value = "";
            return;
        }
        if (!f.type.startsWith("image/")) {
            setError("Only image files are allowed.");
            e.target.value = "";
            return;
        }

        setError(null);
        setFile(f);
        setPreviewUrl(URL.createObjectURL(f));
    };

    const clearImage = () => {
        setFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        if (inputRef.current) inputRef.current.value = "";
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!title.trim() || !content.trim()) {
            setError("Title and content are required.");
            return;
        }

        setLoading(true);
        try {
            const form = new FormData();
            form.append("title", title);
            form.append("content", content);
            if (file) form.append("image", file);

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
                clearImage();
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
            <div className="bg-white p-6 rounded-xl shadow-lg w-96 relative">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 p-1 hover:bg-zinc-100 rounded-full transition"
                    aria-label="Close"
                    type="button"
                >
                    <X size={24} />
                </button>

                <h2 className="text-xl font-bold mb-4">Create Post</h2>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <input
                        className="border rounded-lg px-3 py-2"
                        type="text"
                        placeholder="Title"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        disabled={loading}
                        required
                    />

                    <textarea
                        className="border rounded-lg px-3 py-2 resize-none min-h-[80px]"
                        placeholder="What's on your mind?"
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        disabled={loading}
                        required
                    />

                    {/* Image picker + preview */}
                    <div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Attach image (optional)</label>
                            {file && (
                                <button
                                    type="button"
                                    onClick={clearImage}
                                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                                    title="Remove image"
                                    disabled={loading}
                                >
                                    <Trash2 size={14} />
                                    Remove
                                </button>
                            )}
                        </div>

                        <div className="mt-2">
                            {!previewUrl ? (
                                <button
                                    type="button"
                                    onClick={onPickFile}
                                    className="w-full border border-dashed rounded-lg py-6 flex flex-col items-center justify-center hover:bg-zinc-50 transition"
                                    disabled={loading}
                                >
                                    <ImageIcon size={22} className="mb-1" />
                                    <span className="text-sm text-zinc-600">Click to choose an image</span>
                                    <span className="text-[11px] text-zinc-400 mt-1">
                                        PNG, JPG, WEBP, GIF · up to 8MB
                                    </span>
                                </button>
                            ) : (
                                <div className="rounded-lg border p-2">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={previewUrl}
                                        alt="Preview"
                                        className="max-h-64 w-full object-contain rounded-md"
                                    />
                                </div>
                            )}
                        </div>

                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={onFileChange}
                            disabled={loading}
                        />
                    </div>

                    {error && <div className="text-red-500 text-sm">{error}</div>}

                    <button
                        className="bg-green-600 text-white rounded-lg py-2 font-semibold mt-2 hover:bg-green-700 transition disabled:opacity-60"
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
