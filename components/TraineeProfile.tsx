"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { UserPlus, UserMinus, MessageSquare, Share2, Lock } from "lucide-react";
import { useFollow } from "@/app/hooks/useFollow";
import FollowListModal from "@/components/FollowListModal";
import NotificationsModal from "@/components/NotificationsModal";

type Post = {
    id: string;
    title: string;
    imageUrl?: string | null;
};

export function TraineeProfile({ user, posts }: { user: any; posts?: Post[] }) {
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

    // Expanded post state (fills the grey content area)
    const [openPostId, setOpenPostId] = useState<string | null>(null);

    // optimistic requested state to avoid flicker on private follow
    const [optimisticRequested, setOptimisticRequested] = useState(false);
    useEffect(() => {
        if (!isPending) setOptimisticRequested(false);
    }, [isPending]);

    const canViewPrivate = useMemo(
        () => isOwnProfile || isFollowing || !user.isPrivate,
        [isOwnProfile, isFollowing, user.isPrivate]
    );

    // Share
    const [shareHint, setShareHint] = useState<string | null>(null);

    // Posts fallback
    const [localPosts, setLocalPosts] = useState<Post[]>(posts ?? []);
    useEffect(() => {
        let ignore = false;
        async function load() {
            if (posts && posts.length) return;
            try {
                const res = await fetch(`/api/user/${encodeURIComponent(user.id)}/posts`, {
                    cache: "no-store",
                });
                if (!res.ok) return;
                const data = await res.json();
                if (!ignore) setLocalPosts(Array.isArray(data) ? data : []);
            } catch { }
        }
        if (canViewPrivate) load();
        return () => {
            ignore = true;
        };
    }, [user.id, posts, canViewPrivate]);

    // Followers / Following modals
    const [showFollowers, setShowFollowers] = useState(false);
    const [showFollowing, setShowFollowing] = useState(false);
    const [list, setList] = useState<any[]>([]);

    const openFollowers = async () => {
        if (!canViewPrivate) return; // block for private if not follower
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
        if (!canViewPrivate) return; // block for private if not follower
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
                if (isFollowing) {
                    await unfollow();
                } else if (isPending || optimisticRequested) {
                    // retract request
                    setOptimisticRequested(false);
                    await (cancelRequest?.() ?? unfollow());
                } else {
                    // send request
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

    // Notifications modal (manual refresh)
    const [showNotifications, setShowNotifications] = useState(false);

    // effective requested state
    const requested = user.isPrivate ? isPending || optimisticRequested : false;

    return (
        <div className="flex min-h-screen">
            <aside className="w-72 bg-white flex flex-col items-center pt-8">
                {/* Avatar */}
                <div className="flex justify-center items-center mb-3">
                    {user.image ? (
                        <img
                            src={user.image}
                            alt={user.username || user.name || "Profile picture"}
                            className="w-24 h-24 rounded-full object-cover border-4 border-white"
                        />
                    ) : (
                        <div className="w-24 h-24 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                            <span className="text-green-700 font-bold text-xl select-none text-center px-2 break-words">
                                {user.username || user.name || "User"}
                            </span>
                        </div>
                    )}
                </div>

                <h2 className="font-bold text-xl">{user.name}</h2>
                <div className="text-gray-500 text-sm mb-3">{user.role?.toLowerCase()}</div>

                {/* Follow / Message / Share — hidden on own profile */}
                {!isOwnProfile && (
                    <>
                        <div className="flex items-center gap-3 mb-4">
                            <button
                                onClick={handleFollowButton}
                                disabled={loading}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm bg-white hover:bg-[#f8f8f8] transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                                className="flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm bg-white hover:bg-[#f8f8f8] transition"
                                title="Message"
                            >
                                <MessageSquare size={20} />
                            </button>

                            <button
                                onClick={handleShare}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm bg-white hover:bg-[#f8f8f8] transition"
                                title="Share profile"
                            >
                                <Share2 size={20} />
                            </button>
                        </div>
                        {shareHint && <div className="text-xs text-gray-500 mb-2">{shareHint}</div>}
                    </>
                )}

                {/* Bio & location */}
                <div className="text-center my-4">{trainee?.bio || "this is my bio"}</div>
                <div className="text-center text-sm text-gray-600 mb-2">{user.location}</div>

                {/* Stats (followers/following clickable) */}
                <div className="flex flex-col gap-2 my-4 w-full px-6">
                    <button
                        onClick={openFollowers}
                        disabled={!canViewPrivate}
                        className={`flex justify-between ${canViewPrivate ? "hover:underline" : "opacity-60 cursor-not-allowed"
                            }`}
                        title={canViewPrivate ? "View followers" : "Private"}
                    >
                        <span className="font-semibold">{followers}</span>
                        <span className="text-gray-500">followers</span>
                    </button>
                    <button
                        onClick={openFollowing}
                        disabled={!canViewPrivate}
                        className={`flex justify-between ${canViewPrivate ? "hover:underline" : "opacity-60 cursor-not-allowed"
                            }`}
                        title={canViewPrivate ? "View following" : "Private"}
                    >
                        <span className="font-semibold">{following}</span>
                        <span className="text-gray-500">following</span>
                    </button>
                    <ProfileStat label="posts" value={canViewPrivate ? localPosts.length : "—"} />
                </div>

                {/* Own-profile buttons at the bottom */}
                {isOwnProfile && (
                    <div className="flex flex-col gap-2 mb-6">
                        <button
                            className="w-44 py-2 border rounded-xl bg-white hover:bg-[#f8f8f8] transition font-medium"
                            onClick={() => setShowNotifications(true)}
                        >
                            View Notifications
                        </button>
                        <button
                            className="w-44 py-2 border rounded-xl bg-white hover:bg-[#f8f8f8] transition font-medium"
                            onClick={() => router.push("/settings")}
                        >
                            Edit Profile
                        </button>
                    </div>
                )}
            </aside>

            {/* MAIN: grid OR inline post viewer */}
            <main className="relative flex-1 p-8">
                {openPostId ? (
                    <ProfilePostViewer postId={openPostId} onClose={() => setOpenPostId(null)} />
                ) : canViewPrivate ? (
                    <MediaGrid posts={localPosts} onOpen={setOpenPostId} />
                ) : (
                    <PrivatePlaceholder />
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

function ProfileStat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between">
            <span className="font-semibold">{value}</span>
            <span className="text-gray-500">{label}</span>
        </div>
    );
}

/** Grid of media tiles; clicking a tile opens the inline viewer */
function MediaGrid({ posts, onOpen }: { posts: Post[]; onOpen: (id: string) => void }) {
    return (
        <div className="grid grid-cols-3 gap-2">
            {posts.map((post) => (
                <button
                    key={post.id}
                    onClick={() => onOpen(post.id)}
                    className="bg-white rounded-lg w-full h-56 overflow-hidden relative border hover:shadow focus:outline-none focus:ring-2 focus:ring-green-600/30"
                    title={post.title}
                >
                    {post.imageUrl ? (
                        <img src={post.imageUrl} alt={post.title} className="object-cover w-full h-full" />
                    ) : (
                        <span className="text-gray-600 font-semibold text-lg text-center px-4 inline-flex items-center justify-center w-full h-full">
                            {post.title}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}

/** Fills the grey content area with a full, interactive post (iframe) */
function ProfilePostViewer({ postId, onClose }: { postId: string; onClose: () => void }) {
    // Close on Escape
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="absolute inset-0">
            <button
                onClick={onClose}
                className="absolute top-2 left-2 z-10 px-3 py-1.5 rounded-full border bg-white/90 backdrop-blur text-sm hover:bg-white shadow"
                title="Back to profile"
            >
                ← Back to profile
            </button>
            <iframe
                src={`/post/${encodeURIComponent(postId)}`}
                className="w-full h-full rounded-lg border bg-white"
                title="Post"
            />
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
