// /app/profile/page.tsx

'use client';

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TraineeProfile } from "@/components/TraineeProfile";
import { TrainerProfile } from "@/components/TrainerProfile";
import { GymProfile } from "@/components/GymProfile";
import MobileHeader from "@/components/MobileHeader";

export default function ProfilePage() {
    const { data: session } = useSession();
    const router = useRouter();
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

    useEffect(() => {
        if (!loading && user && !user.role) {
            const params = new URLSearchParams();
            params.set("google", "1");
            if (user.email) params.set("email", user.email as string);
            if (user.username || user.name) {
                params.set("name", user.username ?? user.name ?? "");
            }
            router.push(`/sign-up?${params.toString()}`);
        }
    }, [loading, router, user]);

    if (loading) return <div className="p-8 text-gray-500">Loading profile...</div>;
    if (!user) return <div className="p-8 text-red-500">User not found</div>;

    const username = session?.user?.username ?? user?.username ?? "Profile";

    const Shell = ({ children }: { children: React.ReactNode }) => (
        <div className="min-h-screen bg-[#f8f8f8] flex flex-col dark:bg-[#050505]">
            <MobileHeader title={username} href="/profile" />

            {/* Desktop header */}
            <header className="hidden lg:flex sticky top-0 z-30 w-full py-6 justify-start pl-[40px] bg-white dark:bg-neutral-900">
                <h1 className="font-roboto text-3xl text-green-700 tracking-tight select-none dark:text-green-400">
                    <span>{username}</span>
                </h1>
            </header>

            {/* Scrollable content */}
            <main className="flex-1 w-full">
                {children}
            </main>
        </div>
    );

    switch (user.role) {
        case "TRAINEE":
            return (
                <Shell>
                    <TraineeProfile user={user} posts={posts} />
                </Shell>
            );

        case "TRAINER":
            return (
                <Shell>
                    <TrainerProfile user={user} posts={posts} />
                </Shell>
            );

        case "GYM":
            return (
                <Shell>
                    <GymProfile user={user} posts={posts} />
                </Shell>
            );

        default:
            return <div className="p-8 text-gray-500">Redirecting to finish onboarding…</div>;
    }
}
