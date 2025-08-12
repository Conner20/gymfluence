// app/profile/TraineeProfile.tsx

'use client';

import React from "react";
import { useRouter } from "next/navigation";

export function TrainerProfile({ user, posts }) {
    const router = useRouter();
    const trainer = user.trainerProfile;

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
                        <div className="w-24 h-24 rounded-full bg-white border-1 border-gray flex items-center justify-center">
                            <span className="text-green-700 font-bold text-xl select-none text-center px-2 break-words">
                                {user.username || user.name || "User"}
                            </span>
                        </div>
                    )}
                </div>
                <h2 className="font-bold text-xl">{user.name}</h2>
                <div className="text-gray-500 text-sm mb-2">{user.role.toLowerCase()}</div>
                {/* Tagline / bio */}
                <div className="text-center my-4">{trainer?.bio || "this is my bio"}</div>
                <div className="text-center text-sm text-gray-600 mb-2">{user.location}</div>
                <div className="flex flex-col gap-2 my-4 w-full px-6">
                    {/* Follower counts – placeholder (customize if needed) */}
                    <ProfileStat label="rating" value={trainer?.rating?.toFixed(1) ?? "N/A"} />
                    <ProfileStat label="followers" value={trainer?.followers ?? "0"} />
                    <ProfileStat label="following" value={trainer?.following ?? "0"} />
                    <ProfileStat label="posts" value={posts.length} />
                    <ProfileStat label="clients" value={trainer?.clients ?? "0"} />
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


// // TrainerProfile.tsx

// export function TrainerProfile({ user, posts }) {
//     const trainer = user.trainerProfile;

//     return (
//         <div className="flex min-h-screen">
//             {/* Sidebar */}
//             <aside className="w-72 bg-white flex flex-col items-center pt-8 shadow-lg">
//                 <img src={user.image || "/default-avatar.png"} alt={user.name} className="w-24 h-24 rounded-full mb-3" />
//                 <h2 className="font-bold text-xl">{user.name}</h2>
//                 <div className="text-gray-500 text-sm">Trainer</div>
//                 <div className="text-center my-4">{trainer?.bio}</div>
//                 <div className="flex flex-col gap-2 my-6 w-full px-6">
//                     <ProfileStat label="rating" value={trainer?.rating?.toFixed(1) ?? "N/A"} />
//                     <ProfileStat label="followers" value={trainer?.followers ?? "—"} />
//                     <ProfileStat label="following" value={trainer?.following ?? "—"} />
//                     <ProfileStat label="posts" value={posts.length} />
//                     <ProfileStat label="clients" value={trainer?.clients ?? "—"} />
//                 </div>
//                 <button className="w-full mb-2 py-2 border rounded-xl">View Availability</button>
//                 <button className="w-full mb-2 py-2 border rounded-xl">Edit Profile</button>
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
