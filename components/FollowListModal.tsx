// components/FollowListModal.tsx
'use client';

import Link from "next/link";
import { X } from "lucide-react";
import { useSession } from "next-auth/react";

type SimpleUser = {
    id: string;
    username: string | null;
    name: string | null;
    image?: string | null;
};

export default function FollowListModal({
    open,
    title,
    items,
    onClose,
    currentUserId, // NEW (optional)
}: {
    open: boolean;
    title: string;
    items: SimpleUser[];
    onClose: () => void;
    currentUserId?: string;
}) {
    const { data: session } = useSession();
    const me = currentUserId ?? session?.user?.id;

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <button className="p-1 rounded hover:bg-gray-100" onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                {items.length === 0 ? (
                    <div className="text-sm text-gray-400">No users to show.</div>
                ) : (
                    <ul className="divide-y">
                        {items.map((u) => {
                            const href =
                                me && me === u.id
                                    ? "/profile"
                                    : `/u/${encodeURIComponent(u.username || u.id)}`;

                            return (
                                <li key={u.id} className="py-2 flex items-center gap-3">
                                    {u.image ? (
                                        <img
                                            src={u.image}
                                            alt={u.username || "avatar"}
                                            className="w-8 h-8 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs">
                                            {(u.username || u.name || "U").slice(0, 2)}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <Link href={href} className="font-medium hover:underline truncate">
                                            {u.username || u.name || "User"}
                                        </Link>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
