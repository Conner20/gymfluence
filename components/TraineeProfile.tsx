"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    UserPlus,
    UserMinus,
    MessageSquare,
    Share2,
    Lock,
    ArrowLeft,
    Heart,
    MessageCircle,
    Trash2,
    MapPin,
} from "lucide-react";
import { useFollow } from "@/app/hooks/useFollow";
import FollowListModal from "@/components/FollowListModal";
import NotificationsModal from "@/components/NotificationsModal";
import CreatePost from "@/components/CreatePost";
import clsx from "clsx";
import PostDetail from "@/components/PostDetail";
import { PostComments } from "@/components/PostComments";
import { formatRelativeTime } from "@/lib/utils";

type BasicPost = {
    id: string;
    title: string;
    imageUrl?: string | null;
};

type FullPost = {
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

export function TraineeProfile({ user, posts }: { user: any; posts?: BasicPost[] }) {
    const router = useRouter();
    const pathname = usePathname();
    const { data: session } = useSession();

    const isOwnProfile = pathname === "/profile" || session?.user?.id === user.id;
    const trainee = user.traineeProfile;

    const {
        loading,
        isFollowing,
        isPending,
        followers,
        following,
        follow,
        unfollow,
        requestFollow,
        cancelRequest,
        refreshCounts,
    } = useFollow(user.id);

    const [optimisticRequested, setOptimisticRequested] = useState(false);
    useEffect(() => {
        if (!isPending) setOptimisticRequested(false);
    }, [isPending]);

    const canViewPrivate = useMemo(
        () => isOwnProfile || isFollowing || !user.isPrivate,
        [isOwnProfile, isFollowing, user.isPrivate]
    );

    const [shareHint, setShareHint] = useState<string | null>(null);
    const [shareActive, setShareActive] = useState(false);

    // Posts
    const [gridPosts, setGridPosts] = useState<BasicPost[]>(posts ?? []);
    const [fullPosts, setFullPosts] = useState<FullPost[] | null>(null);
    const [postsLoading, setPostsLoading] = useState(false);
    const [showCreatePost, setShowCreatePost] = useState(false);

    const [focusPostId, setFocusPostId] = useState<string | null>(null);

    const refreshPosts = useCallback(async () => {
        if (!canViewPrivate) return;
        setPostsLoading(true);
        try {
            const res = await fetch(`/api/posts?authorId=${encodeURIComponent(user.id)}`, {
                cache: "no-store",
            });
            if (!res.ok) return;
            const data: FullPost[] = await res.json();
            setFullPosts(data);
            setGridPosts(
                data.map((p) => ({
                    id: p.id,
                    title: p.title,
                    imageUrl: p.imageUrl ?? null,
                }))
            );
        } finally {
            setPostsLoading(false);
        }
    }, [user.id, canViewPrivate]);

    useEffect(() => {
        refreshPosts();
    }, [refreshPosts]);

    // When a post is created via CreatePost, refresh this profile
    useEffect(() => {
        if (!isOwnProfile) return;
        const handler = () => {
            refreshPosts();
        };
        window.addEventListener("post-created", handler);
        return () => window.removeEventListener("post-created", handler);
    }, [isOwnProfile, refreshPosts]);

    const handleDeletePost = async (postId: string) => {
        if (!isOwnProfile) return;
        const ok = window.confirm("Delete this post? This cannot be undone.");
        if (!ok) return;

        try {
            const res = await fetch("/api/posts", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: postId }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(data.message || "Failed to delete post.");
                return;
            }

            setFullPosts((prev) => (prev ? prev.filter((p) => p.id !== postId) : prev));
            setGridPosts((prev) => prev.filter((p) => p.id !== postId));
            if (focusPostId === postId) setFocusPostId(null);
        } catch {
            alert("Failed to delete post.");
        }
    };

    // Followers / Following
    const [showFollowers, setShowFollowers] = useState(false);
    const [showFollowing, setShowFollowing] = useState(false);
    const [list, setList] = useState<any[]>([]);

    const openFollowers = async () => {
        if (!canViewPrivate) return;
        setList([]);
        setShowFollowers(true);
        try {
            const res = await fetch(`/api/user/${user.id}/followers`, { cache: "no-store" });
            setList(res.ok ? await res.json() : []);
        } catch {
            setList([]);
        }
    };
    const openFollowing = async () => {
        if (!canViewPrivate) return;
        setList([]);
        setShowFollowing(true);
        try {
            const res = await fetch(`/api/user/${user.id}/following`, { cache: "no-store" });
            setList(res.ok ? await res.json() : []);
        } catch {
            setList([]);
        }
    };

    const handleFollowButton = async () => {
        if (loading) return;
        try {
            if (user.isPrivate) {
                if (isFollowing) await unfollow();
                else if (isPending || optimisticRequested) {
                    setOptimisticRequested(false);
                    await (cancelRequest?.() ?? unfollow());
                } else {
                    setOptimisticRequested(true);
                    await (requestFollow?.() ?? follow());
                }
            } else {
                if (isFollowing) await unfollow();
                else await follow();
            }
        } finally {
            refreshCounts();
        }
    };

    const handleMessage = () => router.push(`/messages?to=${encodeURIComponent(user.id)}`);

    const handleShare = async () => {
        const url = `${window.location.origin}/u/${user.username || user.id}`;
        try {
            await navigator.clipboard.writeText(url);
            setShareHint("Profile link copied!");
            setShareActive(true);
        } catch {
            setShareHint(url);
            setShareActive(false);
        }
        setTimeout(() => {
            setShareHint(null);
            setShareActive(false);
        }, 2000);
    };

    const [showNotifications, setShowNotifications] = useState(false);

    // View mode
    const [viewMode, setViewMode] = useState<"grid" | "scroll">("grid");

    const requested = user.isPrivate ? isPending || optimisticRequested : false;

    return (
        <div className="flex min-h-screen w-full flex-col lg:flex-row gap-6 lg:gap-0 bg-[#f8f8f8] dark:bg-[#050505] dark:text-gray-100">
            {/* Sidebar (profile content) – mobile top, desktop sticky */}
            <aside
                className={clsx(
                    "w-full bg-white flex flex-col items-center pt-6 pb-6 shadow-sm lg:shadow-none dark:bg-[#050505] dark:bg-neutral-900 dark:border-b dark:border-white/5 dark:text-gray-100",
                    "lg:w-72 lg:pt-8 lg:pb-0 lg:sticky lg:top-[84px] lg:self-start lg:h-[calc(100vh-84px)]"
                )}
            >
                <div className="w-full px-6 flex flex-col items-center gap-4">
                    {/* Avatar */}
                    <div className="flex justify-center items-center">
                        {user.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={user.image}
                                alt={user.username || user.name || "Profile picture"}
                                className="w-20 h-20 rounded-full object-cover border border-gray-200 dark:border-white/20"
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center dark:bg-neutral-800 dark:border-white/20">
                                <span className="text-green-700 font-semibold text-lg select-none dark:text-green-400">
                                    {(user.name || user.username || "U").slice(0, 2)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Name / handle / role */}
                    <div className="text-center space-y-1">
                        <h2 className="font-semibold text-lg text-zinc-900 truncate max-w-[200px] dark:text-white">
                            {user.name || user.username || "User"}
                        </h2>
                        {user.role && (
                            <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                {user.role.toLowerCase()}
                            </div>
                        )}
                    </div>

                    {/* Location (subtle) */}
                    {user.location && (
                        <div className="text-xs text-gray-500 text-center flex items-center justify-center gap-1 dark:text-gray-400">
                            <MapPin size={15} />
                            <span>{user.location}</span>
                        </div>
                    )}


                    {/* Stats row */}
                    <div className="w-full mt-2">
                        <div className="flex items-center justify-between text-center text-xs text-gray-500 dark:text-gray-400">
                            <button
                                onClick={openFollowers}
                                disabled={!canViewPrivate}
                                className={clsx(
                                    "flex-1 flex flex-col py-1 rounded-md text-center items-center",
                                    canViewPrivate
                                        ? "hover:bg-gray-50 transition dark:hover:bg-white/5"
                                        : "opacity-60 cursor-not-allowed"
                                )}
                                title={canViewPrivate ? "View followers" : "Private"}
                            >
                                <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                                    {followers}
                                </span>
                                <span className="block text-[11px] tracking-wide">followers</span>
                            </button>
                            <div className="w-px h-8 bg-gray-200 dark:bg-white/10" />
                            <button
                                onClick={openFollowing}
                                disabled={!canViewPrivate}
                                className={clsx(
                                    "flex-1 flex.flex-col py-1 rounded-md text-center items-center",
                                    canViewPrivate
                                        ? "hover:bg-gray-50 transition dark:hover:bg-white/5"
                                        : "opacity-60 cursor-not-allowed"
                                )}
                                title={canViewPrivate ? "View following" : "Private"}
                            >
                                <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                                    {following}
                                </span>
                                <span className="block text-[11px] tracking-wide">following</span>
                            </button>
                            <div className="w-px h-8 bg-gray-200 dark:bg-white/10" />
                            <div className="flex-1 flex flex-col py-1 text-center items-center">
                                <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                                    {canViewPrivate ? (fullPosts?.length ?? gridPosts.length) : "—"}
                                </span>
                                <span className="block text-[11px] tracking-wide">posts</span>
                            </div>
                        </div>
                    </div>

                    {/* Bio – trimmed & subtle */}
                    {trainee?.bio && (
                        <p className="mt-3 text-sm leading-relaxed text-zinc-700 text-center line-clamp-4 dark:text-gray-300">
                            {trainee.bio}
                        </p>
                    )}

                    {/* Actions */}
                    <div className="w-full mt-4 space-y-2">
                        {!isOwnProfile ? (
                            <>
                                <button
                                    onClick={handleFollowButton}
                                    disabled={loading}
                                    className={clsx(
                                        "w-full py-2 rounded-full text-sm font-medium transition",
                                        "border border-zinc-900 text-zinc-900 hover:bg-zinc-900 hover:text-white",
                                        "dark:border-white dark:text-white dark:hover:bg-white/10",
                                        "disabled:opacity-60 disabled:cursor-not-allowed"
                                    )}
                                >
                                    {user.isPrivate ? (
                                        isFollowing ? (
                                            <span className="inline-flex items-center justify-center gap-2">
                                                <UserMinus size={16} />
                                                <span>Unfollow</span>
                                            </span>
                                        ) : requested ? (
                                            <span className="inline-flex items-center justify-center">
                                                Request sent
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center justify-center gap-2">
                                                <UserPlus size={16} />
                                                <span>Request to follow</span>
                                            </span>
                                        )
                                    ) : isFollowing ? (
                                        <span className="inline-flex items-center justify-center gap-2">
                                            <UserMinus size={16} />
                                            <span>Unfollow</span>
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center justify-center gap-2">
                                            <UserPlus size={16} />
                                            <span>Follow</span>
                                        </span>
                                    )}
                                </button>


                                <div className="flex gap-2">
                                    <button
                                        onClick={handleMessage}
                                        className="flex-1 py-1.5 rounded-full border text-xs text-zinc-700 bg-white hover:bg-gray-50 transition flex items-center justify-center gap-1 dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                    >
                                        <MessageSquare size={16} />
                                        <span>Message</span>
                                    </button>
                                    <button
                                        onClick={handleShare}
                                        className={clsx(
                                            "w-9 h-9 shrink-0 rounded-full border bg-white hover:bg-gray-50 transition inline-flex items-center justify-center p-0 dark:bg-transparent dark:hover:bg-white/10",
                                            shareActive
                                                ? "text-green-500 border-green-500 dark:text-green-400 dark:border-green-500"
                                                : "text-zinc-700 border-gray-200 dark:text-gray-100 dark:border-white/20"
                                        )}
                                        title="Copy profile link"
                                    >
                                        <Share2 size={16} />
                                    </button>
                                </div>

                                {shareHint && (
                                    <div className="text-[11px] text-gray-500 text-center dark:text-gray-400">
                                        {shareHint}
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <button
                                        className="w-full py-2 rounded-full border text-sm text-zinc-700 bg-white hover:bg-gray-50 transition dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                    onClick={() => router.push("/settings")}
                                >
                                    Edit profile
                                </button>
                                <button
                                    className="w-full py-2 rounded-full border text-sm text-zinc-700 bg-white hover:bg-gray-50 transition dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                    onClick={() => setShowNotifications(true)}
                                >
                                    View notifications
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </aside>


            {/* Main Content + overlay */}
            <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 relative bg-[#f8f8f8] min-h-screen lg:min-h-full dark:bg-[#050505] dark:text-gray-100">
                {!canViewPrivate ? (
                    <PrivatePlaceholder />
                ) : (
                    <>
                        {/* Header row – now sticky */}
                        <div className="mb-4 flex items-center justify-between bg-[#f8f8f8] py-2 lg:sticky lg:top-0 lg:z-10 dark:bg-[#050505]">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Posts</h3>
                                {isOwnProfile && (
                                    <button
                                        type="button"
                                        onClick={() => setShowCreatePost(true)}
                                        className="px-3 py-1.5 rounded-full border text-xs font-medium bg-white hover:bg-zinc-50 transition dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                    >
                                        + Add Post
                                    </button>
                                )}
                            </div>
                            <div className="inline-flex rounded-full border bg-white p-1 shadow-sm dark:bg-transparent dark:border-white/10">
                                <button
                                    className={clsx(
                                        "px-3 py-1 text-sm rounded-full",
                                        viewMode === "grid"
                                            ? "bg-black text-white dark:bg-white dark:text-black"
                                            : "text-gray-600 hover:bg-zinc-50 dark:text-gray-300 dark:hover:bg-white/10"
                                    )}
                                    onClick={() => setViewMode("grid")}
                                >
                                    Grid
                                </button>
                                <button
                                    className={clsx(
                                        "px-3 py-1 text-sm rounded-full",
                                        viewMode === "scroll"
                                            ? "bg-black text-white dark:bg-white dark:text-black"
                                            : "text-gray-600 hover:bg-zinc-50 dark:text-gray-300 dark:hover:bg-white/10"
                                    )}
                                    onClick={() => setViewMode("scroll")}
                                >
                                    Scroll
                                </button>
                            </div>
                        </div>

                        {postsLoading && !fullPosts && (
                            <div className="text-gray-500 dark:text-gray-400">Loading posts…</div>
                        )}

                        {viewMode === "grid" ? (
                            <MediaGrid posts={gridPosts} onOpen={(id) => setFocusPostId(id)} />
                        ) : (
                            <ScrollFeed
                                posts={fullPosts ?? []}
                                canDelete={isOwnProfile}
                                onDelete={handleDeletePost}
                                onOpen={(id) => setFocusPostId(id)}
                                onLike={async (id) => {
                                    try {
                                        await fetch(
                                            `/api/posts/${encodeURIComponent(id)}/like`,
                                            { method: "POST" }
                                        );
                                        await refreshPosts();
                                    } catch {
                                        /* ignore */
                                    }
                                }}
                            />
                        )}
                    </>
                )}

                {/* Focus overlay */}
                {focusPostId && (
                    <div className="fixed inset-0 bg-[#f8f8f8] z-50 w-full h-full overflow-y-auto lg:absolute lg:overflow-hidden dark:bg-[#050505]">
                        <div className="p-4 flex items-center justify-between sticky top-0 bg-[#f8f8f8] z-10 dark:bg-[#050505]">
                            <button
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white hover:bg-zinc-50 text-sm dark:bg-transparent dark:text-gray-100 dark:border-white/20 dark:hover:bg-white/10"
                                onClick={() => setFocusPostId(null)}
                                title="Back to profile"
                            >
                                <ArrowLeft size={16} />
                                Back
                            </button>
                            {isOwnProfile && (
                                <button
                                    className="p-2 rounded-full text-gray-300 hover:text-red-500 transition dark:text-gray-500 dark:hover:text-red-500"
                                    title="Delete post"
                                    onClick={() => handleDeletePost(focusPostId)}
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                        <div className="px-3 sm:px-6 pb-6">
                            <div className="rounded-xl bg-[#f8f8f8] scrollbar-slim max-w-full max-h-[calc(100vh-140px)] overflow-y-auto dark:bg-[#050505] dark:shadow-none">
                                <PostDetail postId={focusPostId} flat />
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Modals */}
            <FollowListModal
                open={showFollowers}
                title="Followers"
                items={list}
                onClose={() => setShowFollowers(false)}
                currentUserId={session?.user?.id}
            />
            <FollowListModal
                open={showFollowing}
                title="Following"
                items={list}
                onClose={() => setShowFollowing(false)}
                currentUserId={session?.user?.id}
            />
            <NotificationsModal
                open={showNotifications}
                onClose={() => setShowNotifications(false)}
                onAnyChange={refreshCounts}
            />

            {showCreatePost && <CreatePost onClose={() => setShowCreatePost(false)} />}
        </div>
    );
}

function ProfileStat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between">
            <span className="font-semibold dark:text-white">{value}</span>
            <span className="text-gray-500 dark:text-gray-400">{label}</span>
        </div>
    );
}

function MediaGrid({ posts, onOpen }: { posts: BasicPost[]; onOpen: (id: string) => void }) {
    return (
        <div className="grid grid-cols-3 gap-3">
            {posts.map((post) => (
                <button
                    key={post.id}
                    className="bg-white rounded-xl flex items-center justify-center w-full h-56 overflow-hidden border border-zinc-200 hover:shadow-sm hover:opacity-95 transition dark:bg-neutral-900 dark:border-white/10"
                    title={post.title}
                    onClick={() => onOpen(post.id)}
                >
                    {post.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={post.imageUrl}
                            alt={post.title}
                            className="object-cover w-full h-full"
                        />
                    ) : (
                        <span className="text-gray-700 font-medium text-base text-center px-4 dark:text-gray-100">
                            {post.title}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}


function ScrollFeed({
    posts,
    onOpen,
    onLike,
    canDelete,
    onDelete,
}: {
    posts: FullPost[];
    onOpen: (id: string) => void;
    onLike: (id: string) => void | Promise<void>;
    canDelete: boolean;
    onDelete: (id: string) => void | Promise<void>;
}) {
    const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
    const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const fmt = (iso: string) => formatRelativeTime(iso);

    const toggleComments = (id: string) =>
        setOpenComments((prev) => ({ ...prev, [id]: !prev[id] }));

    const handleShare = async (id: string) => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const url = `${origin}/post/${encodeURIComponent(id)}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopiedId(id);
            setTimeout(() =>
                setCopiedId((prev) => (prev === id ? null : prev)),
                2000
            );
        } catch {
            alert('Failed to copy link.');
        }
    };

    if (!posts || posts.length === 0) {
        return <div className="text-gray-400 text-center py-12 dark:text-gray-500">No posts yet.</div>;
    }

    return (
        <div className="space-y-6 max-w-xl dark:text-gray-100">
            {posts.map((p) => {
                const authorBits = (
                    <>
                        <span className="text-xs text-gray-500 dark:text-gray-300">
                            by{' '}
                            {p.author?.username ? (
                                <Link
                                    href={`/u/${encodeURIComponent(p.author.username)}`}
                                    className="font-semibold hover:underline"
                                >
                                    {p.author.username}
                                </Link>
                            ) : (
                                <span className="font-semibold">Unknown</span>
                            )}
                        </span>
                        <span
                            className="text-xs text-gray-400 dark:text-gray-300"
                            title={new Date(p.createdAt).toLocaleString()}
                        >
                            {fmt(p.createdAt)}
                        </span>
                    </>
                );

                const actionButtons = (
                    <>
                        <button
                            className={clsx(
                                'flex items-center gap-1 text-xs transition',
                                p.didLike
                                    ? 'text-red-500 font-bold'
                                    : 'text-gray-400 hover:text-red-400 dark:text-gray-300 dark:hover:text-red-500'
                            )}
                            onClick={() => onLike(p.id)}
                            title={p.didLike ? 'Unlike' : 'Like'}
                        >
                            <Heart
                                size={18}
                                fill={p.didLike ? 'currentColor' : 'none'}
                                strokeWidth={2}
                            />
                            {p.likeCount ?? 0}
                        </button>

                        <button
                            className={clsx(
                                'flex items-center gap-1 text-xs transition',
                                openComments[p.id]
                                    ? 'text-green-500 font-semibold'
                                    : 'text-gray-400 hover:text-green-600 dark:text-gray-300 dark:hover:text-green-500'
                            )}
                            onClick={() => toggleComments(p.id)}
                            title="Toggle comments"
                        >
                            <MessageCircle size={16} />
                            {commentCounts[p.id] ?? p.commentCount ?? 0}
                        </button>

                        <button
                            className="flex items-center gap-1 text-xs transition text-gray-500 hover:text-green-700 dark:text-gray-300 dark:hover:text-green-500"
                            onClick={() => handleShare(p.id)}
                            title="Copy link"
                        >
                            <Share2 size={16} />
                            {copiedId === p.id ? 'Copied' : 'Share'}
                        </button>
                    </>
                );

                return (
                    <article
                        key={p.id}
                        className="relative bg-white rounded-2xl shadow-lg px-6 py-5 text-gray-900 dark:bg-neutral-900 dark:border dark:border-white/10 dark:shadow-none dark:text-gray-100"
                    >
                        {canDelete && (
                            <button
                                className="absolute right-4 top-4 text-gray-300 hover:text-red-500 transition dark:text-gray-500 dark:hover:text-red-500"
                                title="Delete post"
                                onClick={() => onDelete(p.id)}
                            >
                                <Trash2 size={20} />
                            </button>
                        )}

                        <div className="flex flex-col gap-1 mb-2">
                            <button
                                className="font-bold text-lg text-gray-800 text-left hover:underline dark:text-white"
                                onClick={() => onOpen(p.id)}
                                title="Open post"
                            >
                                {p.title}
                            </button>

                        <div className="flex flex-wrap items-center gap-2 md:hidden text-gray-600 dark:text-gray-400">
                                {authorBits}
                            </div>
                            <div className="hidden md:flex flex-wrap items-center gap-3 text-gray-600 dark:text-gray-400">
                                {authorBits}
                                <div className="flex flex-wrap items-center gap-4">
                                    {actionButtons}
                                </div>
                            </div>
                        </div>

                        <div className="mt-2 flex md:hidden flex-wrap items-center gap-4 text-gray-600 dark:text-gray-400">
                            {actionButtons}
                        </div>

                        {p.content && (
                            <div className="text-zinc-800 mt-3 whitespace-pre-wrap dark:text-gray-200">{p.content}</div>
                        )}

                        {p.imageUrl && (
                            <div className="mt-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={p.imageUrl}
                                    alt=""
                                    className="w-full max-h-[540px] object-contain rounded-xl border cursor-pointer dark:border-white/10"
                                    onClick={() => onOpen(p.id)}
                                />
                            </div>
                        )}

                        {openComments[p.id] && (
                            <div className="mt-3">
                                <PostComments
                                    postId={p.id}
                                    onCountChange={(count) =>
                                        setCommentCounts((prev) => ({ ...prev, [p.id]: count }))
                                    }
                                />
                            </div>
                        )}
                    </article>
                );
            })}
        </div>
    );
}


function PrivatePlaceholder() {
    return (
        <div className="w-full h-[60vh] flex items-center justify-center">
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                <Lock size={20} />
                <span>This account is private. Follow to see their posts.</span>
            </div>
        </div>
    );
}
