// /app/profile/page.tsx

'use client';

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { TraineeProfile } from "@/components/TraineeProfile";
import { TrainerProfile } from "@/components/TrainerProfile";
import { GymProfile } from "@/components/GymProfile";
import Navbar from "@/components/Navbar";
// ...import your icons, clsx, etc

export default function ProfilePage() {
    const { data: session } = useSession();
    const [user, setUser] = useState<any>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!session?.user?.email) return;
        (async () => {
            const res = await fetch(`/api/profile?email=${session.user.email}`);
            const data = await res.json();
            setUser(data.user);
            setPosts(data.posts);
            setLoading(false);
        })();
    }, [session?.user?.email]);

    if (loading) return <div className="p-8 text-gray-500">Loading profile...</div>;
    if (!user) return <div className="p-8 text-red-500">User not found</div>;

    // Render based on role
    switch (user.role) {
        case "TRAINEE":
            return <div className="min-h-screen bg-[#f8f8f8]">
                <header className="w-full bg-white py-6 flex justify-start pl-[40px] z-20">
                    <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none">
                        <span>{session?.user.username}</span>
                    </h1>
                </header>
                <TraineeProfile user={user} posts={posts} />;
                <Navbar />
            </div>
            
        case "TRAINER":
            return <div className="min-h-screen bg-[#f8f8f8]">
                <header className="w-full bg-white py-6 flex justify-start pl-[40px] z-20">
                    <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none">
                        <span>{session?.user.username}</span>
                    </h1>
                </header>
                <TrainerProfile user={user} posts={posts} />;
                <Navbar />
            </div>
        case "GYM":
            return <div className="min-h-screen bg-[#f8f8f8]">
                <header className="w-full bg-white py-6 flex justify-start pl-[40px] z-20">
                    <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none">
                        <span>{session?.user.username}</span>
                    </h1>
                </header>
                <GymProfile user={user} posts={posts} />;
                <Navbar />
            </div>
        default:
            return <div className="p-8 text-red-500">
                Unknown role
                <Navbar />
            </div>;
            
    }


}