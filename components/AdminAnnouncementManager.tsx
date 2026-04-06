'use client';

import { Image as ImageIcon, Megaphone, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import PostImageCarousel from "@/components/PostImageCarousel";

type Announcement = {
    id: string;
    title: string;
    content: string;
    imageUrl: string | null;
    imageUrls: string[];
    createdAt: string;
    updatedAt: string;
};

type SelectedImage = {
    id: string;
    file: File;
    previewUrl: string;
};

const normalizeImageUrls = (announcement: Announcement | null) =>
    announcement?.imageUrls?.length
        ? announcement.imageUrls
        : announcement?.imageUrl
            ? [announcement.imageUrl]
            : [];

export default function AdminAnnouncementManager() {
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
    const [newImages, setNewImages] = useState<SelectedImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const inputRef = useRef<HTMLInputElement | null>(null);
    const newImagesRef = useRef<SelectedImage[]>([]);

    const loadAnnouncement = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch("/api/admin/announcement", { cache: "no-store" });
            if (!res.ok) throw new Error("Unable to load announcement.");
            const data = await res.json();
            const current = data?.announcement ?? null;
            setAnnouncement(current);
            setTitle(current?.title ?? "");
            setContent(current?.content ?? "");
            setExistingImageUrls(normalizeImageUrls(current));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to load announcement.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadAnnouncement();
    }, []);

    useEffect(() => {
        newImagesRef.current = newImages;
    }, [newImages]);

    useEffect(() => {
        return () => {
            newImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
        };
    }, []);

    const onPickFile = () => inputRef.current?.click();

    const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        if (!files.length) return;

        const maxBytes = 8 * 1024 * 1024;
        const currentCount = existingImageUrls.length + newImages.length;
        const nextImages: SelectedImage[] = [];

        for (const file of files) {
            if (file.size > maxBytes) {
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
            event.target.value = "";
            return;
        }

        if (currentCount + nextImages.length > 5) {
            nextImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
            setError("You can upload up to 5 images.");
            event.target.value = "";
            return;
        }

        setError(null);
        setNewImages((current) => [...current, ...nextImages]);
        event.target.value = "";
    };

    const removeExistingImage = (url: string) => {
        setExistingImageUrls((current) => current.filter((value) => value !== url));
        if (inputRef.current) inputRef.current.value = "";
    };

    const removeNewImage = (id: string) => {
        setNewImages((current) => {
            const target = current.find((image) => image.id === id);
            if (target) URL.revokeObjectURL(target.previewUrl);
            return current.filter((image) => image.id !== id);
        });
        if (inputRef.current) inputRef.current.value = "";
    };

    const clearImages = () => {
        newImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
        setExistingImageUrls([]);
        setNewImages([]);
        if (inputRef.current) inputRef.current.value = "";
    };

    const saveAnnouncement = async () => {
        const nextTitle = title.trim();
        const nextContent = content.trim();
        if (!nextTitle || !nextContent) {
            setError("Title and caption are required.");
            return;
        }

        try {
            setSaving(true);
            setError(null);
            setMessage(null);

            const form = new FormData();
            form.append("title", nextTitle);
            form.append("content", nextContent);
            form.append("retainedImageUrls", JSON.stringify(existingImageUrls));
            newImages.forEach((image) => form.append("images", image.file));

            const res = await fetch("/api/admin/announcement", {
                method: announcement ? "PATCH" : "POST",
                body: form,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Failed to save announcement.");

            setAnnouncement(data.announcement);
            setExistingImageUrls(normalizeImageUrls(data.announcement));
            newImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
            setNewImages([]);
            setMessage(announcement ? "Announcement updated." : "Announcement published.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save announcement.");
        } finally {
            setSaving(false);
        }
    };

    const deleteAnnouncement = async () => {
        try {
            setSaving(true);
            setError(null);
            setMessage(null);
            const res = await fetch("/api/admin/announcement", { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Failed to delete announcement.");

            newImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
            setNewImages([]);
            setAnnouncement(null);
            setTitle("");
            setContent("");
            setExistingImageUrls([]);
            setMessage("Announcement removed.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete announcement.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-sm uppercase tracking-wide text-zinc-500 dark:text-white/60">
                        <Megaphone size={16} />
                        Announcement
                    </div>
                </div>
                {announcement && (
                    <button
                        type="button"
                        onClick={() => void deleteAnnouncement()}
                        className="inline-flex items-center gap-2 rounded-full border border-red-200 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
                        disabled={saving}
                    >
                        <Trash2 size={14} />
                        Remove
                    </button>
                )}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(380px,1.1fr)]">
                <div className="space-y-4">
                    <input
                        className="w-full rounded-2xl border border-black/10 px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-black/20 dark:border-white/15 dark:bg-transparent dark:text-white dark:placeholder:text-gray-500"
                        placeholder="Title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        disabled={loading || saving}
                    />
                    <div className="relative">
                        {!content && (
                            <span className="pointer-events-none absolute left-4 top-3 text-sm text-zinc-400 dark:text-gray-500">
                                Caption
                            </span>
                        )}
                        <textarea
                            className="scrollbar-slim min-h-[180px] w-full rounded-2xl border border-black/10 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black/20 dark:border-white/15 dark:bg-transparent dark:text-white"
                            value={content}
                            onChange={(event) => setContent(event.target.value)}
                            disabled={loading || saving}
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-zinc-700 dark:text-gray-200">Photos (optional, up to 5)</label>
                            {(existingImageUrls.length > 0 || newImages.length > 0) && (
                                <button
                                    type="button"
                                    onClick={clearImages}
                                    className="text-xs text-red-600 hover:text-red-700"
                                    disabled={saving}
                                >
                                    Clear all
                                </button>
                            )}
                        </div>

                        <div className="mt-2">
                            {existingImageUrls.length === 0 && newImages.length === 0 ? (
                                <button
                                    type="button"
                                    onClick={onPickFile}
                                    className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 py-8 text-sm text-zinc-600 transition hover:bg-zinc-50 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/5"
                                    disabled={loading || saving}
                                >
                                    <ImageIcon size={20} className="mb-2" />
                                    Add photos
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        {existingImageUrls.map((url) => (
                                            <div key={url} className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/15">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={url} alt="Announcement preview" className="h-36 w-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeExistingImage(url)}
                                                    className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white"
                                                    aria-label="Remove image"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        {newImages.map((image) => (
                                            <div key={image.id} className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/15">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={image.previewUrl} alt="Announcement preview" className="h-36 w-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeNewImage(image.id)}
                                                    className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white"
                                                    aria-label="Remove image"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    {existingImageUrls.length + newImages.length < 5 && (
                                        <button
                                            type="button"
                                            onClick={onPickFile}
                                            className="w-full rounded-2xl border border-dashed border-black/10 px-4 py-3 text-sm text-zinc-600 transition hover:bg-zinc-50 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/5"
                                            disabled={loading || saving}
                                        >
                                            Add another photo ({existingImageUrls.length + newImages.length}/5)
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
                            disabled={loading || saving}
                        />
                    </div>

                    {error && <div className="text-sm text-red-500">{error}</div>}
                    {message && <div className="text-sm text-green-600 dark:text-green-400">{message}</div>}

                    <button
                        type="button"
                        onClick={() => void saveAnnouncement()}
                        className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                        disabled={loading || saving}
                    >
                        {saving ? "Saving..." : announcement ? "Update" : "Publish"}
                    </button>
                </div>

                <div className="rounded-3xl border border-black/5 bg-[#f8f8f8] p-4 dark:border-white/10 dark:bg-[#050505]">
                    <div className="rounded-3xl border border-green-700/25 bg-white p-5 shadow-sm dark:border-green-400/25 dark:bg-neutral-900">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-green-700 dark:text-green-400">
                            <Megaphone size={14} />
                            Announcement
                        </div>
                        <h3 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-white">
                            {title.trim() || "Title"}
                        </h3>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-gray-200">
                            {content.trim() || "Caption"}
                        </p>
                        {(existingImageUrls.length > 0 || newImages.length > 0) && (
                            <div className="mt-4">
                                <PostImageCarousel
                                    imageUrls={[
                                        ...existingImageUrls,
                                        ...newImages.map((image) => image.previewUrl),
                                    ]}
                                    alt={title.trim() || "Announcement preview"}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
