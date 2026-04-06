'use client';

import Link from "next/link";
import { Megaphone, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import PostImageCarousel from "@/components/PostImageCarousel";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Announcement = {
    id: string;
    title: string;
    content: string;
    imageUrl?: string | null;
    imageUrls?: string[];
    createdAt: string;
};

type HomeAnnouncementProps = {
    announcement: Announcement;
    isAdmin?: boolean;
    deleting?: boolean;
    onDelete?: () => void;
};

const getImageUrls = (announcement: Announcement) =>
    announcement.imageUrls?.length
        ? announcement.imageUrls
        : announcement.imageUrl
            ? [announcement.imageUrl]
            : [];

export default function HomeAnnouncement({
    announcement,
    isAdmin = false,
    deleting = false,
    onDelete,
}: HomeAnnouncementProps) {
    const imageUrls = getImageUrls(announcement);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    return (
        <div className="mx-auto mt-6 w-full max-w-xl">
            <section className="mb-5 rounded-[28px] border border-green-700/25 bg-white px-5 py-5 shadow-sm dark:border-green-400/25 dark:bg-neutral-900">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-green-700 dark:text-green-400">
                        <Megaphone size={14} />
                        Announcement
                    </div>
                    {isAdmin && (
                        <div className="flex items-center gap-2">
                            <Link
                                href="/admin/announcement"
                                className="text-gray-300 transition hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
                                title="Edit announcement"
                            >
                                <Pencil size={18} />
                            </Link>
                            <button
                                type="button"
                                onClick={() => setConfirmDeleteOpen(true)}
                                className="text-gray-300 transition hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-500 dark:hover:text-red-500"
                                title={deleting ? "Deleting..." : "Delete announcement"}
                                disabled={deleting}
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    )}
                </div>
                <h2 className="mt-3 text-lg font-bold text-gray-800 dark:text-white">
                    {announcement.title}
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-gray-700 dark:text-gray-200">
                    {announcement.content}
                </p>
                {imageUrls.length > 0 && (
                    <div className="mt-4">
                        <PostImageCarousel imageUrls={imageUrls} alt={announcement.title} />
                    </div>
                )}
            </section>
            {isAdmin && (
                <ConfirmDialog
                    open={confirmDeleteOpen}
                    title="Delete announcement"
                    message="Are you sure you want to delete this?"
                    destructive
                    onCancel={() => setConfirmDeleteOpen(false)}
                    onConfirm={() => {
                        setConfirmDeleteOpen(false);
                        onDelete?.();
                    }}
                />
            )}
        </div>
    );
}
