// app/settings/privacy-toggle.tsx
'use client';

import { useEffect, useState } from "react";

export default function PrivacyToggle() {
    const [isPrivate, setIsPrivate] = useState<boolean | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            const res = await fetch("/api/user/privacy");
            if (res.ok) {
                const data = await res.json();
                setIsPrivate(!!data.isPrivate);
            }
        })();
    }, []);

    const toggle = async () => {
        if (isPrivate === null) return;
        setSaving(true);
        try {
            const res = await fetch("/api/user/privacy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isPrivate: !isPrivate }),
            });
            if (res.ok) {
                const data = await res.json();
                setIsPrivate(!!data.isPrivate);
            }
        } finally {
            setSaving(false);
        }
    };

    const baseBtn =
        "px-3 py-1 rounded-full border text-sm transition disabled:opacity-50";
    const publicStyles = "bg-transparent hover:bg-gray-100 hover:bg-gray-100 dark:text-white dark:hover:bg-white/10";
    const privateStyles = "bg-gray-900 text-white border-gray-900 hover:bg-black dark:bg-white dark:text-black dark:border-white dark:hover:bg-gray-200";

    return (
        <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">Account Privacy</span>
            <button
                onClick={toggle}
                disabled={saving || isPrivate === null}
                className={`${baseBtn} ${isPrivate ? privateStyles : publicStyles}`}
                title="Toggle public/private"
            >
                {isPrivate ? "Private" : "Public"}
            </button>
        </div>
    );
}
