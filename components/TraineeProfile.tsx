"use client";

import React, { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { useFollow } from "@/app/hooks/useFollow";
import FollowListModal from "@/components/FollowListModal";
import NotificationsModal from "@/components/NotificationsModal";
import clsx from "clsx";

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

    // Posts
    const [gridPosts, setGridPosts] = useState<BasicPost[]>(posts ?? []);
    const [fullPosts, setFullPosts] = useState<FullPost[] | null>(null);
    const [postsLoading, setPostsLoading] = useState(false);

    useEffect(() => {
        let ignore = false;
        async function load() {
            if (!canViewPrivate) return;
            setPostsLoading(true);
            try {
                const res = await fetch(`/api/posts?authorId=${encodeURIComponent(user.id)}`, { cache: "no-store" });
                if (!res.ok) return;
                const data: FullPost[] = await res.json();
                if (ignore) return;
                setFullPosts(data);
                setGridPosts(data.map((p) => ({ id: p.id, title: p.title, imageUrl: p.imageUrl ?? null })));
            } finally {
                if (!ignore) setPostsLoading(false);
            }
        }
        load();
        return () => {
            ignore = true;
        };
    }, [user.id, canViewPrivate]);

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
        } catch {
            setShareHint(url);
        }
        setTimeout(() => setShareHint(null), 2000);
    };

    const [showNotifications, setShowNotifications] = useState(false);

    // View mode & focus post
    const [viewMode, setViewMode] = useState<"grid" | "scroll">("grid");
    const [focusPostId, setFocusPostId] = useState<string | null>(null);

    const requested = user.isPrivate ? isPending || optimisticRequested : false;

    return (
        <div className="flex min-h-screen bg-[#f8f8f8]">
            {/* Sidebar */}
            <aside className="w-80 shrink-0 bg-white px-6 py-8 flex flex-col items-center">
                {/* Avatar */}
                <div className="relative">
                    {user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={user.image}
                            alt={user.username || user.name || "Profile picture"}
                            className="w-28 h-28 rounded-full object-cover border border-zinc-200 shadow-md"
                        />
                    ) : (
                        <div className="w-28 h-28 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                            <span className="text-green-700 font-bold text-xl select-none text-center px-2 break-words">
                                {user.username || user.name || "User"}
                            </span>
                        </div>
                    )}
                </div>

                <h2 className="mt-4 font-semibold text-xl text-zinc-900">{user.name}</h2>
                <div className="text-gray-500 text-sm">{user.role?.toLowerCase()}</div>

                {/* Bio & location */}
                <div className="mt-4 text-center text-zinc-700 leading-relaxed">
                    {trainee?.bio || "this is my bio"}
                </div>
                <div className="text-center text-sm text-gray-600 mt-1">{user.location}</div>

                {/* Action buttons (sleek + responsive) */}
                {!isOwnProfile ? (
                    <>
                        <div className="mt-6 w-full">
                            <div className="flex flex-wrap gap-2 justify-center">
                                <button
                                    onClick={handleFollowButton}
                                    disabled={loading}
                                    className={clsx(
                                        "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm border transition",
                                        isFollowing
                                            ? "bg-white hover:bg-zinc-50 text-zinc-900"
                                            : "bg-green-700 hover:bg-green-800 text-white"
                                    )}
                                    title={
                                        user.isPrivate
                                            ? isFollowing
                                                ? "Unfollow"
                                                : requested
                                                    ? "Requested"
                                                    : "Request Follow"
                                            : isFollowing
                                                ? "Unfollow"
                                                : "Follow"
                                    }
                                    aria-label="Follow toggle"
                                >
                                    {user.isPrivate ? (
                                        isFollowing ? (
                                            <>
                                                <UserMinus size={18} />
                                                <span>Unfollow</span>
                                            </>
                                        ) : requested ? (
                                            <span className="text-xs font-medium">Requested</span>
                                        ) : (
                                            <>
                                                <UserPlus size={18} />
                                                <span>Follow</span>
                                            </>
                                        )
                                    ) : isFollowing ? (
                                        <>
                                            <UserMinus size={18} />
                                            <span>Unfollow</span>
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus size={18} />
                                            <span>Follow</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={handleMessage}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm bg-white hover:bg-zinc-50 transition"
                                    title="Message"
                                >
                                    <MessageSquare size={18} />
                                    <span>Message</span>
                                </button>

                                <button
                                    onClick={handleShare}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm bg-white hover:bg-zinc-50 transition"
                                    title="Share profile"
                                >
                                    <Share2 size={18} />
                                    <span>Share</span>
                                </button>
                            </div>
                            {shareHint && <div className="text-xs text-gray-500 mt-2 text-center">{shareHint}</div>}
                        </div>
                    </>
                ) : (
                    <div className="mt-6 w-full space-y-2">
                        <button
                            className="w-full py-2 rounded-full border bg-white hover:bg-zinc-50 transition text-sm"
                            onClick={() => setShowNotifications(true)}
                        >
                            View Notifications
                        </button>
                        <button
                            className="w-full py-2 rounded-full bg-green-700 hover:bg-green-800 text-white transition text-sm"
                            onClick={() => router.push("/settings")}
                        >
                            Edit Profile
                        </button>
                    </div>
                )}

                {/* Stats (sleek rows) */}
                <div className="mt-8 w-full">
                    <StatRow
                        label="followers"
                        value={followers}
                        onClick={openFollowers}
                        enabled={canViewPrivate}
                    />
                    <StatRow
                        label="following"
                        value={following}
                        onClick={openFollowing}
                        enabled={canViewPrivate}
                    />
                    <ProfileStat
                        label="posts"
                        value={canViewPrivate ? (fullPosts?.length ?? gridPosts.length) : "—"}
                    />
                </div>
            </aside>

            {/* Main Content + overlay */}
            <main className="flex-1 p-8 relative">
                {!canViewPrivate ? (
                    <PrivatePlaceholder />
                ) : (
                    <>
                        {/* Header row */}
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-zinc-900">Posts</h3>
                            <div className="inline-flex rounded-full border bg-white p-1 shadow-sm">
                                <button
                                    className={clsx(
                                        "px-3 py-1 text-sm rounded-full",
                                        viewMode === "grid"
                                            ? "bg-green-700 text-white"
                                            : "text-gray-600 hover:bg-zinc-50"
                                    )}
                                    onClick={() => setViewMode("grid")}
                                >
                                    Grid
                                </button>
                                <button
                                    className={clsx(
                                        "px-3 py-1 text-sm rounded-full",
                                        viewMode === "scroll"
                                            ? "bg-green-700 text-white"
                                            : "text-gray-600 hover:bg-zinc-50"
                                    )}
                                    onClick={() => setViewMode("scroll")}
                                >
                                    Scroll
                                </button>
                            </div>
                        </div>

                        {postsLoading && !fullPosts && (
                            <div className="text-gray-500">Loading posts…</div>
                        )}

                        {viewMode === "grid" ? (
                            <MediaGrid posts={gridPosts} onOpen={(id) => setFocusPostId(id)} />
                        ) : (
                            <ScrollFeed
                                posts={fullPosts ?? []}
                                onOpen={(id) => setFocusPostId(id)}
                                onLike={async (id) => {
                                    try {
                                        await fetch(`/api/posts/${encodeURIComponent(id)}/like`, { method: "POST" });
                                        const res = await fetch(
                                            `/api/posts?authorId=${encodeURIComponent(user.id)}`,
                                            { cache: "no-store" }
                                        );
                                        if (res.ok) setFullPosts(await res.json());
                                    } catch { }
                                }}
                            />
                        )}
                    </>
                )}

                {/* Focus overlay (fills gray area) */}
                {focusPostId && (
                    <div className="absolute inset-0 bg-[#f8f8f8] z-50">
                        <div className="p-4">
                            <button
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white hover:bg-zinc-50 text-sm"
                                onClick={() => setFocusPostId(null)}
                                title="Back to profile"
                            >
                                <ArrowLeft size={16} />
                                Back
                            </button>
                        </div>
                        <div className="h-[calc(100%-56px)] px-6 pb-6">
                            <iframe
                                src={`/post/${encodeURIComponent(focusPostId)}`}
                                className="w-full h-full rounded-xl bg-white shadow"
                            />
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
        </div>
    );
}

function StatRow({
    label,
    value,
    onClick,
    enabled = true,
}: {
    label: string;
    value: React.ReactNode;
    onClick?: () => void;
    enabled?: boolean;
}) {
    return (
        <button
            onClick={enabled ? onClick : undefined}
            disabled={!enabled}
            className={clsx(
                "flex justify-between w-full px-3 py-2 rounded-lg transition",
                enabled ? "hover:bg-zinc-50" : "opacity-50 cursor-not-allowed"
            )}
            title={enabled ? `View ${label}` : "Private"}
        >
            <span className="font-semibold">{value}</span>
            <span className="text-gray-500">{label}</span>
        </button>
    );
}

function ProfileStat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between px-3 py-2 rounded-lg">
            <span className="font-semibold">{value}</span>
            <span className="text-gray-500">{label}</span>
        </div>
    );
}

function MediaGrid({ posts, onOpen }: { posts: BasicPost[]; onOpen: (id: string) => void }) {
    return (
        <div className="grid grid-cols-3 gap-3">
            {posts.map((post) => (
                <button
                    key={post.id}
                    className="bg-white rounded-xl flex items-center justify-center w-full h-56 overflow-hidden border border-zinc-200 hover:shadow-sm hover:opacity-95 transition"
                    title={post.title}
                    onClick={() => onOpen(post.id)}
                >
                    {post.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.imageUrl} alt={post.title} className="object-cover w-full h-full" />
                    ) : (
                        <span className="text-gray-700 font-medium text-base text-center px-4">
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
}: {
    posts: FullPost[];
    onOpen: (id: string) => void;
    onLike: (id: string) => void | Promise<void>;
}) {
    const fmt = (iso: string) =>
        new Date(iso).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });

    if (!posts || posts.length === 0) {
        return <div className="text-gray-400 text-center py-12">No posts yet.</div>;
    }
    return (
        <div className="space-y-6 max-w-2xl">
            {posts.map((p) => (
                <article key={p.id} className="bg-white rounded-2xl shadow-sm border border-zinc-200 px-5 py-4">
                    {/* header like home */}
                    <div className="flex items-center justify-between">
                        <div className="min-w-0">
                            <button
                                className="text-lg font-semibold text-zinc-900 hover:underline"
                                onClick={() => onOpen(p.id)}
                                title="Open post"
                            >
                                {p.title}
                            </button>
                            <div className="text-xs text-gray-500 mt-0.5">
                                by{" "}
                                {p.author?.username ? (
                                    <Link
                                        href={`/u/${encodeURIComponent(p.author.username)}`}
                                        className="font-medium hover:underline"
                                    >
                                        {p.author.username}
                                    </Link>
                                ) : (
                                    <span className="font-medium">Unknown</span>
                                )}{" "}
                                · {fmt(p.createdAt)}
                            </div>
                        </div>
                    </div>

                    {/* media */}
                    {p.imageUrl && (
                        <div className="mt-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={p.imageUrl}
                                alt=""
                                className="w-full max-h-[540px] object-contain rounded-lg border"
                                onClick={() => onOpen(p.id)}
                            />
                        </div>
                    )}

                    {/* content */}
                    {p.content && (
                        <div className="text-zinc-800 mt-3 whitespace-pre-wrap">{p.content}</div>
                    )}

                    {/* actions like home */}
                    <div className="mt-3 flex items-center gap-4 text-sm">
                        <button
                            className={clsx(
                                "inline-flex items-center gap-1 transition",
                                p.didLike ? "text-red-500" : "text-gray-500 hover:text-red-500"
                            )}
                            onClick={() => onLike(p.id)}
                            title={p.didLike ? "Unlike" : "Like"}
                        >
                            <Heart size={18} fill={p.didLike ? "currentColor" : "none"} />
                            {p.likeCount}
                        </button>

                        <button
                            className="inline-flex items-center gap-1 text-gray-500 hover:text-green-600"
                            onClick={() => onOpen(p.id)}
                            title="View comments"
                        >
                            <MessageCircle size={16} />
                            {p.commentCount}
                        </button>
                    </div>
                </article>
            ))}
        </div>
    );
}

function PrivatePlaceholder() {
    return (
        <div className="w-full h-[60vh] flex items-center justify-center">
            <div className="flex items-center gap-3 text-gray-500">
                <Lock size={20} />
                <span>This account is private. Follow to see their posts.</span>
            </div>
        </div>
    );
}
