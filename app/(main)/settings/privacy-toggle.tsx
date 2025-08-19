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

    return (
        <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Account Privacy</span>
            <button
                onClick={toggle}
                disabled={saving || isPrivate === null}
                className={`px-3 py-1 rounded-full border text-sm ${isPrivate ? "bg-gray-900 text-white" : "bg-white"}`}
                title="Toggle public/private"
            >
                {isPrivate ? "Private" : "Public"}
            </button>
        </div>
    );
}
