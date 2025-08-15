// app/profile/GymProfile.tsx
'use client';

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { UserPlus, UserMinus, MessageSquare, Share2 } from "lucide-react";
import { useFollow } from "@/app/hooks/useFollow";
import FollowListModal from "@/components/FollowListModal";

type Post = {
    id: string;
    title: string;
    imageUrl?: string | null;
};

export function GymProfile({ user, posts }: { user: any; posts?: Post[] }) {
    const router = useRouter();
    const pathname = usePathname();
    const { data: session } = useSession();

    const isOwnProfile = pathname === "/profile" || session?.user?.id === user.id;
    const gym = user.gymProfile;

    // Follow hook (server-backed)
    const {
        loading,
        isFollowing,
        followers,
        following,
        follow,
        unfollow,
        refreshCounts,
    } = useFollow(user.id);

    // Share feedback hint
    const [shareHint, setShareHint] = useState<string | null>(null);

    // Fallback: ensure posts show even if not preloaded by the page
    const [localPosts, setLocalPosts] = useState<Post[]>(posts ?? []);
    useEffect(() => {
        let ignore = false;
        async function load() {
            if (posts && posts.length) return;
            try {
                const res = await fetch(`/api/user/${encodeURIComponent(user.id)}/posts`);
                if (!res.ok) return;
                const data = await res.json();
                if (!ignore) setLocalPosts(Array.isArray(data) ? data : []);
            } catch {
                // ignore
            }
        }
        load();
        return () => {
            ignore = true;
        };
    }, [user.id, posts]);

    // Followers / Following modals
    const [showFollowers, setShowFollowers] = useState(false);
    const [showFollowing, setShowFollowing] = useState(false);
    const [list, setList] = useState<any[]>([]);

    const openFollowers = async () => {
        setList([]);               // clear old list to avoid stale flash
        setShowFollowers(true);    // open first for snappier feel
        try {
            const res = await fetch(`/api/user/${user.id}/followers`);
            setList(res.ok ? await res.json() : []);
        } catch {
            setList([]);
        }
    };

    const openFollowing = async () => {
        setList([]);
        setShowFollowing(true);
        try {
            const res = await fetch(`/api/user/${user.id}/following`);
            setList(res.ok ? await res.json() : []);
        } catch {
            setList([]);
        }
    };

    const handleToggleFollow = async () => {
        if (loading) return;
        try {
            if (isFollowing) {
                await unfollow();
            } else {
                await follow();
            }
        } finally {
            // keep numbers fresh after any follow/unfollow
            refreshCounts();
        }
    };

    const handleMessage = () => {
        router.push(`/messages?to=${encodeURIComponent(user.id)}`);
    };

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

    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <aside className="w-72 bg-white flex flex-col items-center pt-8">
                {/* Avatar with fallback */}
                <div className="flex justify-center items-center mb-3">
                    {user.image ? (
                        <img
                            src={user.image}
                            alt={user.username || user.name || "Profile picture"}
                            className="w-24 h-24 rounded-full object-cover border-4 border-white"
                        />
                    ) : (
                        <div className="w-24 h-24 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                            <span className="text-green-700 font-bold text-xl select-none text-center px-2 break-words leading-6">
                                {user.username || user.name || "User"}
                            </span>
                        </div>
                    )}
                </div>

                <h2 className="font-bold text-xl">{user.name}</h2>
                <div className="text-gray-500 text-sm mb-3">{user.role?.toLowerCase()}</div>

                {/* Follow / Message / Share — stays here; hidden on own profile */}
                {!isOwnProfile && (
                    <>
                        <div className="flex items-center gap-3 mb-4">
                            <button
                                onClick={handleToggleFollow}
                                disabled={loading}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm bg-white hover:bg-[#f8f8f8] transition disabled:opacity-50 disabled:cursor-not-allowed"
                                title={isFollowing ? "Unfollow" : "Follow"}
                            >
                                {isFollowing ? <UserMinus size={20} /> : <UserPlus size={20} />}
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
                <div className="text-center my-4">{gym?.bio || "this is my bio"}</div>
                <div className="text-center text-sm text-gray-600 mb-2">{user.location}</div>

                {/* Stats (Followers / Following are clickable) */}
                <div className="flex flex-col gap-2 my-4 w-full px-6">
                    <ProfileStat label="rating" value={gym?.rating?.toFixed(1) ?? "N/A"} />
                    <button
                        onClick={openFollowers}
                        className="flex justify-between hover:underline"
                        title="View followers"
                    >
                        <span className="font-semibold">{followers}</span>
                        <span className="text-gray-500">followers</span>
                    </button>
                    <button
                        onClick={openFollowing}
                        className="flex justify-between hover:underline"
                        title="View following"
                    >
                        <span className="font-semibold">{following}</span>
                        <span className="text-gray-500">following</span>
                    </button>
                    <ProfileStat label="posts" value={localPosts.length} />
                    <ProfileStat label="membership fee" value={gym?.fee ? `$${gym.fee}/mo` : "N/A"} />
                </div>

                {/* Own-profile controls at the very bottom (below stats) */}
                {isOwnProfile && (
                    <div className="flex flex-col gap-2 mb-6">
                        <button
                            className="w-44 py-2 border rounded-xl bg-white hover:bg-[#f8f8f8] transition font-medium"
                            onClick={() => router.push("/profile")}
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

            {/* Main Content */}
            <main className="flex-1 p-8">
                <MediaGrid posts={localPosts} />
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

function MediaGrid({ posts }: { posts: Post[] }) {
    return (
        <div className="grid grid-cols-3 gap-2">
            {posts.map((post) => (
                <div
                    key={post.id}
                    className="bg-white rounded-lg flex items-center justify-center w-full h-56 overflow-hidden relative border"
                    title={post.title}
                >
                    {post.imageUrl ? (
                        <img src={post.imageUrl} alt={post.title} className="object-cover w-full h-full" />
                    ) : (
                        <span className="text-gray-600 font-semibold text-lg text-center px-4">
                            {post.title}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}
