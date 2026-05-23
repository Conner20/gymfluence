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
    const [totalPostCount, setTotalPostCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [profileResolved, setProfileResolved] = useState(false);
    const [isMobilePrompt, setIsMobilePrompt] = useState(false);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                setLoading(true);
                let res: Response | null = null;

                for (let attempt = 0; attempt < 2; attempt += 1) {
                    res = await fetch("/api/profile", {
                        cache: "no-store",
                        credentials: "include",
                    });

                    if (res.ok || res.status === 404) {
                        break;
                    }

                    if (res.status === 401 && attempt === 0) {
                        await new Promise((resolve) => window.setTimeout(resolve, 500));
                        continue;
                    }

                    break;
                }

                if (!res) {
                    throw new Error("Unable to load profile");
                }

                if (!res.ok) {
                    if (res.status === 404) {
                        router.replace("/");
                        return;
                    }
                    if (res.status === 401) {
                        router.replace("/log-in");
                        return;
                    }
                    throw new Error("Unable to load profile");
                }

                const data = await res.json();
                if (cancelled) return;

                setUser(data.user);
                setPosts(data.posts ?? []);
                setTotalPostCount(data.totalPostCount ?? data.posts?.length ?? 0);
                setProfileResolved(true);
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setUser(null);
                    setPosts([]);
                    setTotalPostCount(0);
                    setProfileResolved(true);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [router]);

    useEffect(() => {
        if (!loading && profileResolved && user && !user.role) {
            const params = new URLSearchParams();
            if (user.username || user.name) {
                params.set("username", user.username ?? user.name ?? "");
            }
            router.push(`/user-onboarding?${params.toString()}`);
        }
    }, [loading, profileResolved, router, user]);

    useEffect(() => {
        if (loading || typeof window === 'undefined') return;
        const isMobile = window.matchMedia?.('(pointer: coarse)').matches ?? false;
        setIsMobilePrompt(isMobile);
    }, [loading]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-neutral-950">
                <span className="h-12 w-12 animate-spin rounded-full border-2 border-black border-t-transparent dark:border-white dark:border-t-transparent" />
            </div>
        );
    }
    if (!user) return null;

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
                    <TraineeProfile user={user} posts={posts} totalPostCount={totalPostCount} isMobilePrompt={isMobilePrompt} />
                </Shell>
            );

        case "TRAINER":
            return (
                <Shell>
                    <TrainerProfile user={user} posts={posts} totalPostCount={totalPostCount} isMobilePrompt={isMobilePrompt} />
                </Shell>
            );

        case "GYM":
            return (
                <Shell>
                    <GymProfile user={user} posts={posts} totalPostCount={totalPostCount} isMobilePrompt={isMobilePrompt} />
                </Shell>
            );

        default:
            return <div className="p-8 text-gray-500">Redirecting to finish onboarding…</div>;
    }
}
