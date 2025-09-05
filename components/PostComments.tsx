'use client';

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CornerDownRight } from "lucide-react";

export function PostComments({ postId }: { postId: string }) {
    const { data: session } = useSession();
    const [comments, setComments] = useState<any[]>([]);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchComments = async () => {
        setLoading(true);
        const res = await fetch(`/api/posts/${postId}/comments`);
        setComments(await res.json());
        setLoading(false);
    };

    useEffect(() => { fetchComments(); }, []);

    const handleAdd = async (content: string, parentId?: string) => {
        await fetch(`/api/posts/${postId}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content, parentId }),
        });
        setContent('');
        fetchComments();
    };

    // Recursive comment rendering for replies
    function CommentNode({ comment }: { comment: any }) {
        const [showReply, setShowReply] = useState(false);
        const [replyContent, setReplyContent] = useState('');
        return (
            <div className="ml-0 mb-3">
                <div className="flex gap-2 items-center">
                    <span className="font-semibold">{comment.author?.username || "Unknown"}</span>
                    <span className="text-xs text-gray-400">{new Date(comment.createdAt).toLocaleString()}</span>
                </div>
                <div className="ml-2 mb-1">{comment.content}</div>
                <button className="text-xs text-blue-500 ml-2" onClick={() => setShowReply(!showReply)}>
                    Reply
                </button>
                {showReply && (
                    <div className="ml-4 mt-2 flex gap-1">
                        <input
                            className="border px-2 py-1 rounded text-xs"
                            value={replyContent}
                            onChange={e => setReplyContent(e.target.value)}
                            placeholder="Reply..."
                        />
                        <button
                            className="text-xs bg-blue-500 text-white px-2 py-1 rounded"
                            onClick={() => { handleAdd(replyContent, comment.id); setShowReply(false); }}
                        >
                            <CornerDownRight size={14} />
                        </button>
                    </div>
                )}
                {/* Render replies recursively */}
                {comment.replies?.length > 0 && (
                    <div className="ml-6 mt-1">
                        {comment.replies.map((reply: any) => (
                            <CommentNode key={reply.id} comment={reply} />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl p-3 mt-4">
            <h4 className="font-bold mb-2 text-gray-700">Comments</h4>
            {session &&
                <form
                    onSubmit={e => { e.preventDefault(); handleAdd(content); }}
                    className="flex gap-2 mb-4"
                >
                    <input
                        className="flex-1 border px-2 py-1 rounded"
                        placeholder="Add a comment..."
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        required
                    />
                    <button className="bg-blue-500 text-white px-3 py-1 rounded" type="submit">Post</button>
                </form>
            }
            {loading ? (
                <div>Loading comments...</div>
            ) : (
                comments.length === 0
                    ? <div className="text-gray-400 text-sm">No comments yet.</div>
                    : comments.map(comment => <CommentNode key={comment.id} comment={comment} />)
            )}
        </div>
    );
}
