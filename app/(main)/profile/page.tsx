// /app/profile/page.tsx

'use client';

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TraineeProfile } from "@/components/TraineeProfile";
import { TrainerProfile } from "@/components/TrainerProfile";
import { GymProfile } from "@/components/GymProfile";
import MobileHeader from "@/components/MobileHeader";
import { Share, SquarePlus } from 'lucide-react';

export default function ProfilePage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [profileResolved, setProfileResolved] = useState(false);
    const [showShortcutPrompt, setShowShortcutPrompt] = useState(false);
    const [isMobilePrompt, setIsMobilePrompt] = useState(false);
    const shortcutKey = user ? `fi_shortcut_prompt_${user.id}` : null;

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
                setProfileResolved(true);
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setUser(null);
                    setPosts([]);
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
        if (loading || !user || typeof window === 'undefined') return;
        const isMobile = window.matchMedia?.('(pointer: coarse)').matches ?? false;
        setIsMobilePrompt(isMobile);
        if (!shortcutKey) return;
        const hasSeen = window.localStorage.getItem(shortcutKey);
        if (!hasSeen) {
            setShowShortcutPrompt(true);
            window.localStorage.setItem(shortcutKey, 'true');
        }
    }, [loading, shortcutKey, user]);

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
            {showShortcutPrompt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 text-sm text-neutral-700 shadow-xl dark:bg-neutral-900 dark:text-neutral-200">
                        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Save Fitting In for next time</h2>
                        {isMobilePrompt ? (
                            <div className="mt-3 space-y-2">
                                <p>Add Fitting In to your home screen</p>
                                <ul className="list-disc space-y-1 pl-5">
                                    <li className="flex items-center gap-1">
                                        <span>1. Tap the share button</span>
                                        <Share className="inline-block" />
                                    </li>
                                    <li className="flex items-center gap-1">
                                        <span>2. Choose <strong>Add to Home Screen</strong></span>
                                        <SquarePlus className="inline-block" />
                                    </li>
                                    <li className="flex items-center gap-1">
                                        <span>3. Select <strong>Add</strong></span>
                                    </li>
                                </ul>
                            </div>
                        ) : (
                            <div className="mt-3 space-y-2">
                                <p>Bookmark it so it's always ready when you are</p>
                                <ul className="list-disc space-y-1 pl-5">
                                    <li>Mac: <strong>⌘ Cmd + D</strong></li>
                                    <li>Windows: <strong>Ctrl + D</strong></li>
                                </ul>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowShortcutPrompt(false)}
                            className="mt-5 w-full rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            )}
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
