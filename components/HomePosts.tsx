'use client';

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";

type Post = {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    author: { username: string | null } | null;
};

export default function HomePosts() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { data: session } = useSession();
    const username = session?.user?.username;

    // Fetch posts
    const fetchPosts = async () => {
        setError(null);
        try {
            const res = await fetch("/api/posts");
            const data = await res.json();
            setPosts(data);
        } catch (e) {
            setError("Failed to fetch posts.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchPosts();
        // Poll for real-time updates every 3 seconds
        const interval = setInterval(fetchPosts, 3000);
        return () => clearInterval(interval);
    }, []);

    // Delete post
    const handleDelete = async (id: string) => {
        if (!window.confirm("Delete this post?")) return;
        try {
            const res = await fetch("/api/posts", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) throw new Error();
            setPosts(posts => posts.filter(post => post.id !== id));
        } catch (e) {
            alert("Failed to delete post.");
        }
    };

    if (loading) return <div className="text-gray-500 p-8">Loading posts...</div>;
    if (error) return <div className="text-red-500 p-8">{error}</div>;

    return (
        <div className="w-full max-w-xl mx-auto mt-8">
            <h2 className="text-2xl font-semibold mb-4">Latest Posts</h2>
            <div className="space-y-6">
                {posts.map(post => (
                    <div
                        key={post.id}
                        className="relative bg-white rounded-2xl shadow-lg px-6 py-5"
                    >
                        {/* Only show delete button if the current user is the author */}
                        {post.author?.username === username && (
                            <button
                                onClick={() => handleDelete(post.id)}
                                className="absolute right-4 top-4 text-gray-300 hover:text-red-500 transition"
                                title="Delete post"
                            >
                                <Trash2 size={20} />
                            </button>
                        )}
                        <div className="flex flex-col gap-1 mb-1">
                            <span className="font-bold text-lg text-gray-800">{post.title}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">
                                    by <span className="font-semibold">{post.author?.username || "Unknown"}</span>
                                </span>
                                <span className="text-xs text-gray-400">· {new Date(post.createdAt).toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="text-gray-700 mt-2">{post.content}</div>
                    </div>
                ))}
                {posts.length === 0 && (
                    <div className="text-gray-400 text-center py-12">No posts yet!</div>
                )}
            </div>
        </div>
    );
}
