"use client";

import { X } from "lucide-react";

export default function UserCardPreview({
    open,
    title,
    qrImageUrl,
    downloadHref,
    onClose,
}: {
    open: boolean;
    title: string;
    qrImageUrl: string;
    downloadHref: string;
    onClose: () => void;
}) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="relative w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl dark:border dark:border-white/10 dark:bg-neutral-900">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-3 top-3 rounded-full p-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10"
                    aria-label="Close card preview"
                >
                    <X size={18} />
                </button>
                <div className="mb-4 pr-8">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Scan this QR code to open the profile in Fitting In.
                    </p>
                </div>
                <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={qrImageUrl}
                        alt={title}
                        className="block h-auto w-full"
                    />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                    <a
                        href={downloadHref}
                        className="inline-flex items-center rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                        Download card
                    </a>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/10"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
