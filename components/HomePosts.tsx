'use client';

import { useEffect, useState } from "react";
import { Trash2, Heart, MessageCircle, CornerDownRight } from "lucide-react";
import { useSession } from "next-auth/react";
import clsx from "clsx";

// Types for comments and posts
type Comment = {
    id: string;
    content: string;
    createdAt: string;
    author: { username: string | null, email: string | null } | null;
    replies: Comment[];
};

type Post = {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    author: { username: string | null, email: string | null } | null;
    likeCount: number;
    didLike: boolean;
    commentCount: number;
    comments: Comment[];
};

export default function HomePosts() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openComments, setOpenComments] = useState<{ [postId: string]: boolean }>({});
    const [newComment, setNewComment] = useState<{ [postId: string]: string }>({});
    const [replying, setReplying] = useState<{ [commentId: string]: boolean }>({});
    const [replyContent, setReplyContent] = useState<{ [commentId: string]: string }>({});

    const { data: session } = useSession();
    const username = session?.user?.username;

    // Fetch posts from API (now includes like count, didLike, comments)
    const fetchPosts = async () => {
        setError(null);
        try {
            const res = await fetch("/api/posts");
            if (!res.ok) throw new Error();
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
        const interval = setInterval(fetchPosts, 3000); // auto-refresh
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

    // Like/unlike post
    const handleLike = async (id: string) => {
        try {
            const res = await fetch(`/api/posts/${id}/like`, { method: "POST" });
            if (!res.ok) throw new Error();
            fetchPosts();
        } catch (e) {
            alert("Failed to like/unlike post.");
        }
    };

    // Toggle comment section
    const toggleComments = (postId: string) => {
        setOpenComments(prev => ({
            ...prev,
            [postId]: !prev[postId]
        }));
    };

    // Add new comment to a post
    const handleAddComment = async (postId: string) => {
        if (!newComment[postId]?.trim()) return;
        try {
            const res = await fetch(`/api/posts/${postId}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: newComment[postId] }),
            });
            if (!res.ok) throw new Error();
            setNewComment(prev => ({ ...prev, [postId]: "" }));
            fetchPosts();
        } catch (e) {
            alert("Failed to add comment.");
        }
    };

    // Add reply to a comment
    const handleAddReply = async (postId: string, commentId: string) => {
        if (!replyContent[commentId]?.trim()) return;
        try {
            const res = await fetch(`/api/posts/${postId}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: replyContent[commentId], parentId: commentId }),
            });
            if (!res.ok) throw new Error();
            setReplyContent(prev => ({ ...prev, [commentId]: "" }));
            setReplying(prev => ({ ...prev, [commentId]: false }));
            fetchPosts();
        } catch (e) {
            alert("Failed to reply.");
        }
    };

    // Render comments and replies
    const renderComments = (comments: Comment[], postId: string, depth = 0) => (
        <div className={depth === 0 ? "mt-4" : "ml-6 mt-3"}>
            {comments.map(comment => (
                <div key={comment.id} className="mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">{comment.author?.username || "Unknown"}</span>
                        <span className="text-xs text-gray-400">{new Date(comment.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="text-gray-800 ml-1">{comment.content}</div>
                    <div className="flex gap-2 items-center mt-1">
                        <button
                            className="text-xs text-gray-500 hover:text-green-700 flex items-center gap-1"
                            onClick={() => setReplying(r => ({ ...r, [comment.id]: !r[comment.id] }))}
                        >
                            <CornerDownRight size={14} />
                            Reply
                        </button>
                        {replying[comment.id] && (
                            <form
                                onSubmit={e => { e.preventDefault(); handleAddReply(postId, comment.id); }}
                                className="flex gap-1 mt-1"
                            >
                                <input
                                    className="border rounded px-2 py-1 text-xs"
                                    placeholder="Write a reply..."
                                    value={replyContent[comment.id] || ""}
                                    onChange={e => setReplyContent(r => ({ ...r, [comment.id]: e.target.value }))}
                                />
                                <button
                                    className="bg-green-600 text-white px-2 py-1 rounded text-xs"
                                    type="submit"
                                >Send</button>
                            </form>
                        )}
                    </div>
                    {/* Render replies recursively */}
                    {comment.replies && comment.replies.length > 0 &&
                        renderComments(comment.replies, postId, depth + 1)}
                </div>
            ))}
        </div>
    );

    if (loading) return <div className="text-gray-500 p-8">Loading posts...</div>;
    if (error) return <div className="text-red-500 p-8">{error}</div>;

    return (
        <div className="w-full max-w-xl mx-auto mt-8">
            <h2 className="text-2xl font-semibold mb-4">Latest Posts</h2>
            <div className="space-y-6">
                {posts.map(post => (
                    <div key={post.id} className="relative bg-white rounded-2xl shadow-lg px-6 py-5">
                        {/* Only show delete if current user is the author */}
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
                                <span className="text-xs text-gray-400">
                                    · {new Date(post.createdAt).toLocaleString()}
                                </span>
                                {/* Like button */}
                                <button
                                    className={clsx(
                                        "flex items-center ml-3 gap-1 text-xs transition",
                                        post.didLike
                                            ? "text-red-500 font-bold"
                                            : "text-gray-400 hover:text-red-400"
                                    )}
                                    onClick={() => handleLike(post.id)}
                                    disabled={!session}
                                    title={session ? (post.didLike ? "Unlike" : "Like") : "Sign in to like"}
                                >
                                    <Heart
                                        size={18}
                                        fill={post.didLike ? "currentColor" : "none"}
                                        strokeWidth={2}
                                    />
                                    {post.likeCount}
                                </button>
                                {/* Comment button & count */}
                                <button
                                    className={clsx(
                                        "flex items-center gap-1 text-xs ml-2 transition",
                                        openComments[post.id]
                                            ? "text-green-600 font-semibold"
                                            : "text-gray-400 hover:text-green-600"
                                    )}
                                    onClick={() => toggleComments(post.id)}
                                    title="Show comments"
                                >
                                    <MessageCircle size={16} />
                                    {post.commentCount}
                                </button>
                            </div>
                        </div>
                        <div className="text-gray-700 mt-2">{post.content}</div>
                        {/* Comments section */}
                        {openComments[post.id] && (
                            <div className="bg-white rounded-xl mt-4 p-4">
                                <form
                                    onSubmit={e => { e.preventDefault(); handleAddComment(post.id); }}
                                    className="flex gap-2 mb-3"
                                >
                                    <input
                                        className="flex-1 border rounded px-2 py-1 text-sm"
                                        placeholder="Write a comment..."
                                        value={newComment[post.id] || ""}
                                        onChange={e => setNewComment(c => ({ ...c, [post.id]: e.target.value }))}
                                        disabled={!session}
                                    />
                                    <button
                                        className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                                        type="submit"
                                        disabled={!session}
                                    >Comment</button>
                                </form>
                                {renderComments(post.comments, post.id)}
                            </div>
                        )}
                    </div>
                ))}
                {posts.length === 0 && (
                    <div className="text-gray-400 text-center py-12">No posts yet!</div>
                )}
            </div>
        </div>
    );
}
