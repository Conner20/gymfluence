'use client';

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { UserPlus, UserMinus, MessageSquare, Share2 } from "lucide-react";
import { useFollow } from "@/app/hooks/useFollow";
import FollowListModal from "@/components/FollowListModal";

export function TraineeProfile({ user, posts }: { user: any; posts?: any[] }) {
    const router = useRouter();
    const pathname = usePathname();
    const { data: session } = useSession();

    const isOwnProfile = pathname === "/profile" || session?.user?.id === user.id;
    const trainee = user.traineeProfile;

    // follow state
    const { loading, isFollowing, followers, following, follow, unfollow } = useFollow(user.id);

    // share
    const [shareHint, setShareHint] = useState<string | null>(null);

    // posts fallback
    const [localPosts, setLocalPosts] = useState<any[]>(posts ?? []);
    useEffect(() => {
        let ignore = false;
        async function load() {
            if (posts && posts.length) return;
            try {
                const res = await fetch(`/api/user/${encodeURIComponent(user.id)}/posts`);
                if (!res.ok) return;
                const data = await res.json();
                if (!ignore) setLocalPosts(Array.isArray(data) ? data : []);
            } catch { }
        }
        load();
        return () => { ignore = true; };
    }, [user.id, posts]);

    // modals
    const [showFollowers, setShowFollowers] = useState(false);
    const [showFollowing, setShowFollowing] = useState(false);
    const [list, setList] = useState<any[]>([]);

    const openFollowers = async () => {
        const res = await fetch(`/api/user/${user.id}/followers`);
        setList(res.ok ? await res.json() : []);
        setShowFollowers(true);
    };
    const openFollowing = async () => {
        const res = await fetch(`/api/user/${user.id}/following`);
        setList(res.ok ? await res.json() : []);
        setShowFollowing(true);
    };

    const handleToggleFollow = async () => {
        if (loading) return;
        if (isFollowing) await unfollow();
        else await follow();
    };

    const handleMessage = () => router.push(`/messages?to=${encodeURIComponent(user.id)}`);

    const handleShare = async () => {
        const url = `${window.location.origin}/u/${user.username || user.id}`;
        try { await navigator.clipboard.writeText(url); setShareHint("Profile link copied!"); }
        catch { setShareHint(url); }
        setTimeout(() => setShareHint(null), 2000);
    };

    return (
        <div className="flex min-h-screen">
            <aside className="w-72 bg-white flex flex-col items-center pt-8">
                {/* avatar */}
                <div className="flex justify-center items-center mb-3">
                    {user.image ? (
                        <img src={user.image} alt={user.username || user.name || "Profile picture"} className="w-24 h-24 rounded-full object-cover border-4 border-white" />
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

                {!isOwnProfile && (
                    <>
                        <div className="flex items-center gap-3 mb-4">
                            <button
                                onClick={handleToggleFollow}
                                disabled={loading}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm bg-white hover:bg-[#f8f8f8] transition"
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

                {/* bio & location */}
                <div className="text-center my-4">{trainee?.bio || "this is my bio"}</div>
                <div className="text-center text-sm text-gray-600 mb-2">{user.location}</div>

                {/* stats with clickable followers/following */}
                <div className="flex flex-col gap-2 my-4 w-full px-6">
                    <button onClick={openFollowers} className="flex justify-between hover:underline">
                        <span className="font-semibold">{followers}</span>
                        <span className="text-gray-500">followers</span>
                    </button>
                    <button onClick={openFollowing} className="flex justify-between hover:underline">
                        <span className="font-semibold">{following}</span>
                        <span className="text-gray-500">following</span>
                    </button>
                    <ProfileStat label="posts" value={localPosts.length} />
                </div>

                {isOwnProfile && (
                    <div className="flex flex-col gap-2 mb-6">
                        <button className="w-44 py-2 border rounded-xl bg-white hover:bg-[#f8f8f8] transition font-medium" onClick={() => router.push("/profile")}>
                            View Notifications
                        </button>
                        <button className="w-44 py-2 border rounded-xl bg-white hover:bg-[#f8f8f8] transition font-medium" onClick={() => router.push("/settings")}>
                            Edit Profile
                        </button>
                    </div>
                )}
            </aside>

            <main className="flex-1 p-8">
                <MediaGrid posts={localPosts} />
            </main>

            {/* modals */}
            <FollowListModal open={showFollowers} title="Followers" items={list} onClose={() => setShowFollowers(false)} />
            <FollowListModal open={showFollowing} title="Following" items={list} onClose={() => setShowFollowing(false)} />
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

function MediaGrid({ posts }: { posts: any[] }) {
    return (
        <div className="grid grid-cols-3 gap-2">
            {posts.map((post) => (
                <div key={post.id} className="bg-white rounded-lg flex items-center justify-center w-full h-56 overflow-hidden relative border" title={post.title}>
                    {post.imageUrl ? (
                        <img src={post.imageUrl} alt={post.title} className="object-cover w-full h-full" />
                    ) : (
                        <span className="text-gray-600 font-semibold text-lg text-center px-4">{post.title}</span>
                    )}
                </div>
            ))}
        </div>
    );
}
