// app/profile/TraineeProfile.tsx  (contains GymProfile)

'use client';

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserMinus, MessageSquare, Share2 } from "lucide-react";

export function GymProfile({ user, posts }) {
    const router = useRouter();
    const gym = user.gymProfile;

    // You can initialize this from server data if you have it, for now default false
    const [isFollowing, setIsFollowing] = useState<boolean>(false);
    const [shareHint, setShareHint] = useState<string | null>(null);

    const handleToggleFollow = async () => {
        try {
            // Optimistic toggle
            setIsFollowing((v) => !v);

            // OPTIONAL: wire to your backend when ready
            // const res = await fetch(`/api/follow`, {
            //   method: "POST",
            //   headers: { "Content-Type": "application/json" },
            //   body: JSON.stringify({ targetUserId: user.id }),
            // });
            // if (!res.ok) throw new Error("Failed to update follow");
        } catch (e) {
            // rollback on error
            setIsFollowing((v) => !v);
            console.error(e);
        }
    };

    const handleMessage = () => {
        // Adjust route/query to your messages system
        router.push(`/messages?to=${encodeURIComponent(user.id)}`);
    };

    const handleShare = async () => {
        const url = `${window.location.origin}/profile/${user.username || user.id}`;
        try {
            await navigator.clipboard.writeText(url);
            setShareHint("Profile link copied!");
        } catch {
            // Fallback
            setShareHint(url);
        }
        setTimeout(() => setShareHint(null), 2000);
    };

    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <aside className="w-72 bg-white flex flex-col items-center pt-8">
                {/* Avatar with fallback: */}
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
                <div className="text-gray-500 text-sm mb-3">
                    {user.role?.toLowerCase()}
                </div>

                {/* <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={handleToggleFollow}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm bg-white hover:bg-[#f8f8f8] transition"
                        title={isFollowing ? "Unfollow" : "Follow"}
                    >
                        {isFollowing ? (
                            <>
                                <UserMinus size={20} />
                            </>
                        ) : (
                            <>
                                <UserPlus size={20} />
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
                {shareHint && (
                    <div className="text-xs text-gray-500 mb-2">{shareHint}</div>
                )} */}

                {/* Tagline / bio */}
                <div className="text-center my-4">{gym?.bio || "this is my bio"}</div>
                <div className="text-center text-sm text-gray-600 mb-2">{user.location}</div>

                <div className="flex flex-col gap-2 my-4 w-full px-6">
                    <ProfileStat label="rating" value={gym?.rating?.toFixed(1) ?? "N/A"} />
                    <ProfileStat label="followers" value={gym?.followers ?? "—"} />
                    <ProfileStat label="following" value={gym?.following ?? "—"} />
                    <ProfileStat label="posts" value={posts.length} />
                    <ProfileStat label="membership fee" value={gym?.fee ? `$${gym.fee}/mo` : "N/A"} />
                </div>

                {/* Actions */}
                <button
                    className="w-44 mb-2 py-2 border rounded-xl bg-white hover:bg-[#f8f8f8] transition font-medium"
                    onClick={() => router.push("/profile")}
                >
                    View Notifications
                </button>
                <button
                    className="w-44 mb-2 py-2 border rounded-xl bg-white hover:bg-[#f8f8f8] transition font-medium"
                    onClick={() => router.push("/settings")}
                >
                    Edit Profile
                </button>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8">
                <MediaGrid posts={posts} />
            </main>
        </div>
    );
}

function ProfileStat({ label, value }) {
    return (
        <div className="flex justify-between">
            <span className="font-semibold">{value}</span>
            <span className="text-gray-500">{label}</span>
        </div>
    );
}

function MediaGrid({ posts }) {
    return (
        <div className="grid grid-cols-3 gap-2">
            {posts.map(post => (
                <div
                    key={post.id}
                    className="bg-white rounded-lg flex items-center justify-center w-full h-56 overflow-hidden relative border"
                    title={post.title}
                >
                    {post.imageUrl ? (
                        <img
                            src={post.imageUrl}
                            alt={post.title}
                            className="object-cover w-full h-full"
                        />
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



// // app/profile/GymProfile.tsx

// import React from "react";

// export function GymProfile({ user, posts }) {
//     const gym = user.gymProfile;

//     return (
//         <div className="flex min-h-screen">
//             {/* Sidebar */}
//             <aside className="w-72 bg-white flex flex-col items-center pt-8 shadow-lg">
//                 <img
//                     src={user.image || "/default-avatar.png"}
//                     alt={gym?.name || user.name}
//                     className="w-24 h-24 rounded-full mb-3"
//                 />
//                 <h2 className="font-bold text-xl">{gym?.name || user.name}</h2>
//                 <div className="text-gray-500 text-sm mb-2">fitness center</div>
//                 <div className="text-center my-4">{gym?.address}</div>
//                 <div className="text-center text-sm text-gray-600 mb-2">{user.location}</div>
//                 <div className="flex flex-col gap-2 my-4 w-full px-6">
//                     <ProfileStat label="rating" value={gym?.rating?.toFixed(1) ?? "N/A"} />
//                     <ProfileStat label="followers" value={gym?.followers ?? "—"} />
//                     <ProfileStat label="following" value={gym?.following ?? "—"} />
//                     <ProfileStat label="posts" value={posts.length} />
//                     <ProfileStat label="membership fee" value={gym?.fee ? `$${gym.fee}/mo` : "N/A"} />
//                 </div>
//                 {/* Actions */}
//                 <button className="w-full mb-2 py-2 border rounded-xl">Leave a rating</button>
//             </aside>

//             {/* Main Content */}
//             <main className="flex-1 p-8">
//                 <h1 className="font-roboto text-4xl mb-6">{user.username}_</h1>
//                 <MediaGrid posts={posts} />
//             </main>
//         </div>
//     );
// }

// function ProfileStat({ label, value }) {
//     return (
//         <div className="flex justify-between">
//             <span className="font-semibold">{value}</span>
//             <span className="text-gray-500">{label}</span>
//         </div>
//     );
// }

// function MediaGrid({ posts }) {
//     return (
//         <div className="grid grid-cols-3 gap-2">
//             {posts.map(post => (
//                 <img
//                     key={post.id}
//                     src={post.imageUrl || "/placeholder.jpg"}
//                     alt=""
//                     className="object-cover w-full h-56 rounded-lg"
//                 />
//             ))}
//         </div>
//     );
// }
