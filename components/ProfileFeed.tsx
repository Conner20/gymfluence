'use client';

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Share2 } from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import { PostComments } from "@/components/PostComments";

type Post = {
    id: string;
    title: string;
    content: string;
    imageUrl?: string | null;
    createdAt: string;
    author: { id: string; username: string | null; name: string | null } | null;
    likeCount: number;
    didLike: boolean;
    commentCount: number;
};

export default function ProfileFeed({ authorId }: { authorId: string }) {
    const { data: session } = useSession();
    const router = useRouter();

    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [openComments, setOpenComments] = useState<Record<string, boolean>>({});

    const fetchPosts = async () => {
        setErr(null);
        try {
            const res = await fetch(`/api/posts?authorId=${encodeURIComponent(authorId)}`, { cache: "no-store" });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setPosts(data);
        } catch {
            setErr("Failed to load posts.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchPosts();
    }, [authorId]);

    const handleLike = async (id: string) => {
        try {
            const res = await fetch(`/api/posts/${id}/like`, { method: "POST" });
            if (!res.ok) throw new Error();
            fetchPosts();
        } catch {
            alert("Failed to like/unlike post.");
        }
    };

    if (loading) return <div className="text-gray-500 p-6">Loading posts…</div>;
    if (err) return <div className="text-red-500 p-6">{err}</div>;
    if (posts.length === 0) return <div className="text-gray-400 p-6">No posts yet.</div>;

    return (
        <div className="max-w-2xl">
            {posts.map((post) => (
                <article key={post.id} className="bg-white rounded-2xl shadow px-6 py-5 mb-6">
                    <div className="flex flex-col gap-1 mb-2">
                        <h2 className="font-bold text-xl text-gray-800">{post.title}</h2>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-gray-500">
                                by{" "}
                                {post.author?.username ? (
                                    <Link
                                        href={`/u/${encodeURIComponent(post.author.username)}`}
                                        className="font-semibold hover:underline"
                                        title={`View ${post.author.username}'s profile`}
                                    >
                                        {post.author.username}
                                    </Link>
                                ) : (
                                    <span className="font-semibold">Unknown</span>
                                )}
                            </span>
                            <span className="text-xs text-gray-400">
                                · {new Date(post.createdAt).toLocaleString()}
                            </span>

                            <button
                                className={clsx(
                                    "flex items-center ml-3 gap-1 text-xs transition",
                                    post.didLike ? "text-red-500 font-bold" : "text-gray-400 hover:text-red-400"
                                )}
                                onClick={() => handleLike(post.id)}
                                disabled={!session}
                                title={session ? (post.didLike ? "Unlike" : "Like") : "Sign in to like"}
                            >
                                <Heart size={18} fill={post.didLike ? "currentColor" : "none"} strokeWidth={2} />
                                {post.likeCount}
                            </button>

                            <button
                                className={clsx(
                                    "flex items-center gap-1 text-xs ml-2 transition",
                                    openComments[post.id] ? "text-green-600 font-semibold" : "text-gray-400 hover:text-green-600"
                                )}
                                onClick={() => setOpenComments((s) => ({ ...s, [post.id]: !s[post.id] }))}
                                title="Show comments"
                            >
                                <MessageCircle size={16} />
                                {post.commentCount}
                            </button>

                            <button
                                className="flex items-center gap-1 text-xs ml-2 text-gray-500 hover:text-green-700"
                                title="Share via Messenger"
                                onClick={() =>
                                    router.push(`/messages?shareType=post&shareId=${encodeURIComponent(post.id)}`)
                                }
                            >
                                <Share2 size={16} />
                                Share
                            </button>
                        </div>
                    </div>

                    {post.content && (
                        <div className="text-gray-700 mt-2 whitespace-pre-wrap">{post.content}</div>
                    )}

                    {post.imageUrl && (
                        <div className="mt-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={post.imageUrl}
                                alt={post.title}
                                className="w-full max-h-[540px] object-contain rounded-xl border"
                            />
                        </div>
                    )}

                    {openComments[post.id] && (
                        <div className="mt-4">
                            <PostComments postId={post.id} />
                        </div>
                    )}
                </article>
            ))}
        </div>
    );
}
