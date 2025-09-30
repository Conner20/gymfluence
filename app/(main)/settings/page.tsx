// app/(main)/settings/page.tsx
'use client';

import { useEffect, useState, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import PrivacyToggle from "./privacy-toggle";
import Navbar from "@/components/Navbar";
import SearchProfileEditor from "@/components/SearchProfileEditor";

export default function SettingsPage() {
    const { data: session, status } = useSession();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Text fields
    const [name, setName] = useState("");
    const [location, setLocation] = useState("");
    const [bio, setBio] = useState("");

    // Avatar: persisted URL from server + local preview blob URL
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const previousPreviewRef = useRef<string | null>(null);

    useEffect(() => {
        (async () => {
            const res = await fetch("/api/user/profile");
            if (res.ok) {
                const me = await res.json();
                setName(me.name || "");
                setLocation(me.location || "");
                setBio(me.bio || "");
                setImageUrl(me.image || null);
            }
            setLoading(false);
        })();
    }, []);

    // Clean up blob URLs when changed/unmounted
    useEffect(() => {
        return () => {
            if (previousPreviewRef.current) {
                URL.revokeObjectURL(previousPreviewRef.current);
            }
        };
    }, []);

    const handleFilePick = (picked: File | null) => {
        setFile(picked);
        // revoke the old preview
        if (previousPreviewRef.current) {
            URL.revokeObjectURL(previousPreviewRef.current);
            previousPreviewRef.current = null;
        }
        if (picked) {
            const blobUrl = URL.createObjectURL(picked);
            setPreviewUrl(blobUrl);
            previousPreviewRef.current = blobUrl;
        } else {
            setPreviewUrl(null);
        }
    };

    const onSave = async () => {
        setSaving(true);
        try {
            const form = new FormData();
            form.append("name", name);
            form.append("location", location);
            form.append("bio", bio);
            if (file) form.append("image", file);

            const res = await fetch("/api/user/profile", { method: "PATCH", body: form });
            if (!res.ok) throw new Error();
            const me = await res.json();

            // Use the server URL after save; clear local preview
            setImageUrl(me.image || null);
            if (previousPreviewRef.current) {
                URL.revokeObjectURL(previousPreviewRef.current);
                previousPreviewRef.current = null;
            }
            setPreviewUrl(null);
            setFile(null);

            alert("Profile updated!");
        } catch {
            alert("Failed to save profile.");
        } finally {
            setSaving(false);
        }
    };

    if (status === "loading" || loading) return <div className="p-8 text-gray-500">Loading…</div>;
    if (!session) return <div className="p-8 text-red-500">Please sign in.</div>;

    const displayImage = previewUrl || imageUrl; // show preview immediately if present

    return (
        <div className="min-h-screen bg-[#f8f8f8]">
            <header className="w-full bg-white py-6 flex justify-start pl-[40px] z-20">
                <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none">
                    <span>profile</span>
                </h1>
            </header>

            {/* note the space-y-6 and wrapping SearchProfileEditor in its own white card */}
            <main className="max-w-3xl mx-auto p-6 space-y-6">
                {/* Profile + Privacy card */}
                <div className="bg-white rounded-xl shadow p-6 space-y-6">
                    <section>
                        <h2 className="font-semibold mb-4">Profile</h2>

                        <div className="flex gap-6 items-start">
                            {/* Avatar + upload */}
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-32 h-32 rounded-full bg-gray-100 border flex items-center justify-center overflow-hidden">
                                    {displayImage ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={displayImage} alt="avatar preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-gray-400 text-sm">No image</span>
                                    )}
                                </div>

                                {/* Visible, high-contrast upload button */}
                                <label
                                    htmlFor="avatar-file"
                                    className="inline-flex items-center px-3 py-1.5 rounded-full bg-gray-900 text-white text-sm cursor-pointer hover:bg-black"
                                >
                                    Choose image
                                </label>
                                <input
                                    id="avatar-file"
                                    type="file"
                                    accept="image/*"
                                    className="sr-only"
                                    onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
                                />

                                {/* Filename helper */}
                                <div className="text-xs text-gray-500 min-h-[1rem]">
                                    {file ? file.name : previewUrl ? "Previewing selected image" : ""}
                                </div>

                                {previewUrl && (
                                    <div className="text-[11px] text-gray-500 text-center max-w-[10rem]">
                                        This is a preview. Click <span className="font-medium">Save changes</span> to apply.
                                    </div>
                                )}
                            </div>

                            {/* Fields */}
                            <div className="flex-1 space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Name</label>
                                    <input
                                        className="w-full border rounded px-3 py-2"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">City / Country</label>
                                    <input
                                        className="w-full border rounded px-3 py-2"
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Bio</label>
                                    <textarea
                                        className="w-full border rounded px-3 py-2"
                                        rows={4}
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                    />
                                </div>

                                <button
                                    onClick={onSave}
                                    disabled={saving}
                                    className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50"
                                >
                                    {saving ? "Saving…" : "Save changes"}
                                </button>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="font-semibold mb-2">Privacy</h2>
                        <PrivacyToggle />
                    </section>
                </div>

                {/* Search Profile card (this was missing a white container) */}
                <div className="bg-white rounded-xl shadow p-6 space-y-6">
                    <SearchProfileEditor />
                </div>

                {/* Log Out */}
                <div className="bg-white rounded-xl shadow p-6">
                    <h2 className="font-semibold mb-3">Log Out</h2>
                    <p className="text-sm text-gray-600 mb-4">
                        You are currently signed in as <span className="font-medium">{session?.user?.email || session?.user?.name || "your account"}</span>.
                    </p>
                    <button
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                        aria-label="Log out"
                    >
                        Log Out
                    </button>
                </div>
            </main>

            <Navbar />
        </div>
    );
}
