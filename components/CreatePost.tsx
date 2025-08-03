'use client';

import { X } from "lucide-react";
import { useState } from "react";

export default function CreatePost({
    onClose,
}: {
    onClose: () => void;
}) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!title.trim() || !content.trim()) {
            setError("Title and content are required.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/posts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, content }),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.message || "Failed to create post.");
            } else {
                setTitle('');
                setContent('');
                onClose();
            }
        } catch (err) {
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
                    {error && (
                        <div className="text-red-500 text-sm">{error}</div>
                    )}
                    <button
                        className="bg-green-600 text-white rounded-lg py-2 font-semibold mt-2 hover:bg-green-700 transition"
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
