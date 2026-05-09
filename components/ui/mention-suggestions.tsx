"use client";

import clsx from "clsx";

import type { MentionSearchResult } from "@/lib/mentions";

const truncateDisplayName = (value: string, maxLength = 34) =>
    value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;

export default function MentionSuggestions({
    items,
    loading,
    open,
    onSelect,
    className,
}: {
    items: MentionSearchResult[];
    loading: boolean;
    open: boolean;
    onSelect: (item: MentionSearchResult) => void;
    className?: string;
}) {
    if (!open) return null;

    return (
        <div
            className={clsx(
                "absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-white/10 dark:bg-neutral-900",
                className,
            )}
        >
            {loading ? (
                <div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">Searching…</div>
            ) : items.length === 0 ? (
                <div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">No users found.</div>
            ) : (
                <ul className="max-h-72 overflow-y-auto scrollbar-slim">
                    {items.map((item) => (
                        <li key={item.id}>
                            {(() => {
                                const displayName = item.name || item.username;
                                const shortName = truncateDisplayName(displayName);

                                return (
                            <button
                                type="button"
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    onSelect(item);
                                }}
                                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-white/5"
                            >
                                {item.image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={item.image}
                                        alt={item.username}
                                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold uppercase text-zinc-600 dark:bg-white/10 dark:text-zinc-200">
                                        {displayName.slice(0, 2)}
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium text-zinc-900 dark:text-white" title={displayName}>
                                        {shortName}
                                    </div>
                                    <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                                        @{item.username}
                                    </div>
                                </div>
                            </button>
                                );
                            })()}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
